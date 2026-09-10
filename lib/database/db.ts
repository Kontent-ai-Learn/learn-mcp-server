import { dirname, resolve } from "node:path";
import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { connect, Database } from "@tursodatabase/database";
import { z } from "zod";
import { getOrSetFromMemoryCacheAsync, takeFromMemoryCache } from "../cache/memory-cache.js";
import { getDbPath } from "../config.js";
import type { DocChunk, NormalizedDoc } from "../indexing/indexer.models.js";
import { existsSync, mkdir } from "../utils/file.utils.js";
import { yieldToEventLoop } from "../utils/timeout.utils.js";
import { buildCreateTableQuery, deleteFrom, insertInto, selectFrom } from "./db.utils.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

const DB_CACHE_KEY = "db";

export async function openDb(path: string): Promise<Database> {
	// Resolved up front so the directory that gets created and the file that gets opened cannot
	// disagree, and so a failure reports somewhere a human can go and look.
	const absolutePath = resolve(path);
	const directory = dirname(absolutePath);
	await mkdir(directory);

	const opened = await tryCatchAsync(async () => await connect(absolutePath, { experimental: ["index_method"] }));

	if (!opened.success) {
		throw new Error(describeOpenFailure({ directory, path: absolutePath }), { cause: opened.error });
	}
	await opened.data.exec(buildCreateTablesQuery());
	return opened.data;
}

/** The one connection used to serve searches; reopened lazily after `closeCachedDb`. */
export async function getCachedDb(): Promise<Database> {
	return await getOrSetFromMemoryCacheAsync({
		key: DB_CACHE_KEY,
		schema: z.instanceof(Database),
		value: async () => await openDb(getDbPath()),
	});
}

/**
 * Close and forget the cached connection. Deleting the database files while it is open leaves it
 * reading the unlinked inode — searches would keep serving the pre-clean data and never see a
 * later re-sync — so anything that removes those files must call this first.
 */
export async function closeCachedDb(): Promise<void> {
	const cached = takeFromMemoryCache({ key: DB_CACHE_KEY, schema: z.instanceof(Database) });
	await cached?.close();
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
				values: {
					chunkIndex: chunk.chunkIndex,
					chunkKey: chunk.chunkKey,
					docId: chunk.docId,
					sourceField: chunk.sourceField,
					text: chunk.text,
				},
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
		const statement = await txn.prepare(
			`UPDATE ${CHUNKS_TABLE.tableName} SET ${CHUNKS_TABLE.columns.embedding.name} = vector32(?), ${CHUNKS_TABLE.columns.embeddingModel.name} = ? WHERE ${CHUNKS_TABLE.columns.chunkKey.name} = ?`,
		);
		for (const item of items) {
			await statement.run(toVectorParam(item.vector), model, item.chunkKey);
		}
	});
	await transaction();
}

function buildCreateIndexesQuery(): string {
	return `
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON ${CHUNKS_TABLE.tableName}(${CHUNKS_TABLE.columns.docId.name});
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON ${CHUNKS_TABLE.tableName} USING fts (${CHUNKS_TABLE.columns.text.name});
CREATE INDEX IF NOT EXISTS idx_documents_type ON ${DOCUMENTS_TABLE.tableName}(${DOCUMENTS_TABLE.columns.type.name});
CREATE INDEX IF NOT EXISTS idx_documents_apiReference ON ${DOCUMENTS_TABLE.tableName}(${DOCUMENTS_TABLE.columns.apiReference.name});`;
}

function buildCreateTablesQuery(): string {
	return [buildCreateTableQuery(DOCUMENTS_TABLE), buildCreateTableQuery(CHUNKS_TABLE), buildCreateIndexesQuery()].join("\n");
}

/**
 * libSQL reports a missing parent directory as an opaque
 * `I/O error (statfs shared WAL coordination path): entity not found`, so say what was actually
 * wrong — the directory is the only thing this layer can be responsible for.
 */
function describeOpenFailure({ path, directory }: { readonly path: string; readonly directory: string }): string {
	const directoryState = existsSync(directory) ? "exists" : "does not exist, even though openDb creates it immediately before connecting";
	return `Failed to open database at ${path}. Its directory ${directory} ${directoryState}. Working directory: ${process.cwd()}.`;
}
