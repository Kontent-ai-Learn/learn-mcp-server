import { createHash } from "node:crypto";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { fetchLearnRecords, type SearchRecord } from "../data/learn-api.js";
import { deleteDocuments, getDocHashes, openDb, replaceDocument, selectChunksToEmbed, updateEmbeddings } from "../database/db.js";
import { logger, type SpinnerLog } from "../utils/logger.js";
import { chunkDoc } from "./chunking.js";
import { embedTexts } from "./embeddings.js";
import { EMBED_BATCH_SIZE, EMBEDDING_MODEL, getDbPath } from "./indexer.config.js";
import type { NormalizedDoc } from "./indexer.models.js";

export type IndexDocumentsResult = {
	readonly database: Database;
	readonly changedCount: number;
	readonly removedCount: number;
	readonly unchangedCount: number;
};

export type SyncDbResult = IndexDocumentsResult & {
	readonly documentCount: number;
};

/** Load the latest source documents from the content endpoint and index them into a fresh DB handle. */
export async function syncDatabase(): Promise<SyncDbResult> {
	const { success, error, data } = await fetchLearnRecords();

	if (!success) {
		logger.log({
			message: `Failed to load source documents when syncing database. ${error instanceof Error ? error.message : "Unknown error"}`,
		});
		throw error;
	}
	const indexResult = await indexSourceDocuments(await openDb(getDbPath()), data.searchRecords);

	return {
		documentCount: data.searchRecords.length,
		...indexResult,
	};
}

/**
 * Bring the index up to date with the source: diff by content hash, re-chunk
 * changed docs, then embed any chunk lacking an embedding. Persistent +
 * incremental — unchanged docs keep their existing embeddings across restarts.
 */
export async function indexSourceDocuments(db: Database, sourceDocuments: readonly SearchRecord[]): Promise<IndexDocumentsResult> {
	const normalized = sourceDocuments.map(normalize);

	const result = await logger.logWithSpinnerAsync<IndexDocumentsResult>(async (spinner) => {
		logger.log({ message: `Indexing ${colorize("yellow", normalized.length.toString())} source documents` });
		const { changed, removed, unchanged } = await applyDiff({ db, normalizedDocuments: normalized, spinner });
		const embedded = await embedMissing(db, spinner);
		spinner({
			type: "completed",
			message: `Index ready: ${colorize("yellow", normalized.length.toString())} docs (${colorize("green", changed.toString())} new/changed, ${colorize("gray", unchanged.toString())} unchanged, ${colorize("red", removed.toString())} removed), ${colorize("yellow", embedded.toString())} chunks embedded`,
		});

		return { database: db, changedCount: changed, removedCount: removed, unchangedCount: unchanged };
	});
	return result;
}

function normalizeBody(body: string): string {
	return body.replace(/\r\n/g, "\n").trim();
}

function hashContent(parts: readonly string[]): string {
	return createHash("sha256").update(parts.join(" ")).digest("hex");
}

function normalize(doc: SearchRecord): NormalizedDoc {
	const title = doc.title.trim();
	const url = doc.url.trim();
	const body = normalizeBody(doc.markdownContent);
	return {
		id: doc.id,
		title,
		url,
		body,
		contentHash: hashContent([title, url, body]),
		codename: doc.codename,
	};
}

function toBatches<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
	return Array.from({ length: Math.ceil(items.length / size) }, (_, batch) => items.slice(batch * size, batch * size + size));
}

/** Apply structural changes (new/changed/removed docs), keeping unchanged docs untouched. */
async function applyDiff({
	db,
	normalizedDocuments,
	spinner,
}: {
	readonly db: Database;
	readonly normalizedDocuments: readonly NormalizedDoc[];
	readonly spinner: SpinnerLog;
}): Promise<{ readonly changed: number; readonly removed: number; readonly unchanged: number }> {
	const currentDocHashes = await getDocHashes(db);
	const normalizedDocumentIds = new Set(normalizedDocuments.map((doc) => doc.id));
	const removedDocumentIds: readonly string[] = [...currentDocHashes.keys()].filter((id) => !normalizedDocumentIds.has(id));
	const changedDocuments: readonly NormalizedDoc[] = normalizedDocuments.filter(
		(doc) => currentDocHashes.get(doc.id) !== doc.contentHash,
	);

	await deleteDocuments(db, removedDocumentIds);
	spinner({ message: `Indexing documents ${colorize("yellow", "0")}/${colorize("yellow", changedDocuments.length.toString())}` });
	for (const [index, doc] of changedDocuments.entries()) {
		spinner({
			message: `Indexing documents ${colorize("yellow", (index + 1).toString())}/${colorize("yellow", changedDocuments.length.toString())}`,
		});
		await replaceDocument(db, doc, chunkDoc(doc));
	}
	logger.log({
		message: `\nFinished indexing documents`,
	});
	return {
		changed: changedDocuments.length,
		removed: removedDocumentIds.length,
		unchanged: normalizedDocuments.length - changedDocuments.length,
	};
}

/** Embed every chunk that is missing an embedding for the current model. */
async function embedMissing(db: Database, spinner: SpinnerLog): Promise<number> {
	const chunks = await selectChunksToEmbed(db, EMBEDDING_MODEL);
	const batches = toBatches(chunks, EMBED_BATCH_SIZE);
	logger.log({
		message: `Embedding ${colorize("yellow", chunks.length.toString())} chunks in ${colorize("yellow", batches.length.toString())} batches`,
	});
	spinner({
		message: `Batch ${colorize("yellow", "0")}/${colorize("yellow", batches.length.toString())}`,
	});
	for (const [batchIndex, batch] of batches.entries()) {
		spinner({
			message: `Batch ${colorize("yellow", (batchIndex + 1).toString())}/${colorize("yellow", batches.length.toString())}`,
		});

		const vectors = await embedTexts(batch.map((chunk) => chunk.text));

		await updateEmbeddings(
			db,
			EMBEDDING_MODEL,
			batch.flatMap((chunk, index) => {
				const vector = vectors[index];
				return vector ? [{ chunkKey: chunk.chunkKey, vector }] : [];
			}),
		);
	}

	logger.log({
		message: `\nFinished embedding chunks`,
	});
	return chunks.length;
}
