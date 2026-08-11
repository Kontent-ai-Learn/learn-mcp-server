import { dirname } from "node:path";
import { connect, type Database } from "@tursodatabase/database";
import type { DocChunk, NormalizedDoc } from "../indexing/indexer.models.js";
import { mkdir } from "../utils/file.utils.js";
import { yieldToEventLoop } from "../utils/timeout.utils.js";
import { buildCreateTableQuery, deleteFrom, insertInto, selectFrom, updateTable } from "./db.utils.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

export async function openDb(path: string): Promise<Database> {
	await mkdir(dirname(path));
	const db = await connect(path, { experimental: ["index_method"] });
	await db.exec(buildCreateTablesQuery());
	return db;
}

/** Map of document id -> content hash, for change detection. */
export async function getDocHashes(db: Database): Promise<ReadonlyMap<string, string>> {
	const rows = await selectFrom(db, { columns: ["id", "contentHash"], definition: DOCUMENTS_TABLE });
	return new Map(rows.map((row) => [row.id, row.contentHash]));
}

/** Delete documents (and their chunks) that no longer exist in the source. */
export async function deleteDocuments(db: Database, ids: readonly string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}
	const transaction = db.transactionAsync(async (txn, toDelete: readonly string[]) => {
		for (const id of toDelete) {
			await deleteFrom(txn, { definition: CHUNKS_TABLE, where: { column: "docId", operator: "=", value: id } });
			await deleteFrom(txn, { definition: DOCUMENTS_TABLE, where: { column: "id", operator: "=", value: id } });
			await yieldToEventLoop();
		}
	});
	await transaction(ids);
}

/**
 * Replace a single document and its chunks. New chunks are inserted with a NULL
 * embedding; the embed-missing pass fills them in afterwards.
 */
export async function replaceDocument(db: Database, doc: NormalizedDoc, chunks: readonly DocChunk[]): Promise<void> {
	const transaction = db.transactionAsync(async (txn) => {
		await deleteFrom(txn, { definition: CHUNKS_TABLE, where: { column: "docId", operator: "=", value: doc.id } });
		await deleteFrom(txn, { definition: DOCUMENTS_TABLE, where: { column: "id", operator: "=", value: doc.id } });
		await insertInto(txn, {
			definition: DOCUMENTS_TABLE,
			values: doc,
		});
		for (const chunk of chunks) {
			await insertInto(txn, {
				definition: CHUNKS_TABLE,
				values: { chunkIndex: chunk.chunkIndex, chunkKey: chunk.chunkKey, docId: chunk.docId, text: chunk.text },
			});
		}
	});
	await transaction();
}

export async function selectChunksToEmbed(
	db: Database,
	model: string,
): Promise<readonly { readonly chunkKey: string; readonly text: string }[]> {
	const sql = `SELECT ${CHUNKS_TABLE.columns.chunkKey.name}, ${CHUNKS_TABLE.columns.text.name} FROM ${CHUNKS_TABLE.tableName} WHERE ${CHUNKS_TABLE.columns.embedding.name} IS NULL OR ${CHUNKS_TABLE.columns.embeddingModel.name} IS NOT ?`;
	const rows = (await db.all(sql, model)) as readonly { readonly chunkKey: string; readonly text: string }[];
	return rows.map((row) => ({ chunkKey: row.chunkKey, text: row.text }));
}

export async function updateEmbeddings(
	db: Database,
	model: string,
	items: readonly { readonly chunkKey: string; readonly vector: Float32Array }[],
): Promise<void> {
	if (items.length === 0) {
		return;
	}
	const transaction = db.transactionAsync(async (txn) => {
		for (const item of items) {
			await updateTable(txn, {
				definition: CHUNKS_TABLE,
				set: {
					embedding: { expression: "vector32(?)", params: [toVectorParam(item.vector)] },
					embeddingModel: model,
				},
				where: { column: "chunkKey", value: item.chunkKey },
			});
		}
	});
	await transaction();
}

function buildCreateIndexesQuery(): string {
	return `
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON ${CHUNKS_TABLE.tableName}(${CHUNKS_TABLE.columns.docId.name});
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON ${CHUNKS_TABLE.tableName} USING fts (${CHUNKS_TABLE.columns.text.name});`;
}

function buildCreateTablesQuery(): string {
	return [buildCreateTableQuery(DOCUMENTS_TABLE), buildCreateTableQuery(CHUNKS_TABLE), buildCreateIndexesQuery()].join("\n");
}
