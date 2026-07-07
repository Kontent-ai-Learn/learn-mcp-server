import { createHash } from "node:crypto";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { logger, type SpinnerLog } from "../utils/logger.js";
import { chunkDoc } from "./chunking.js";
import { EMBED_BATCH_SIZE, EMBEDDING_MODEL } from "./config.js";
import { deleteDocuments, getDocHashes, replaceDocument, selectChunksToEmbed, updateEmbeddings } from "./db.js";
import { embedTexts } from "./embeddings.js";
import type { NormalizedDoc, SourceDoc } from "./schema.js";

/**
 * Bring the index up to date with the source: diff by content hash, re-chunk
 * changed docs, then embed any chunk lacking an embedding. Persistent +
 * incremental — unchanged docs keep their existing embeddings across restarts.
 */
export async function indexSourceDocuments(db: Database, sourceDocuments: readonly SourceDoc[]): Promise<Database> {
	const normalized = sourceDocuments.map(normalize);

	await logger.logWithSpinnerAsync(async (spinner) => {
		logger.log({ message: `Indexing ${colorize("yellow", normalized.length.toString())} source documents` });
		const { changed, removed } = await applyDiff(db, normalized, spinner);
		const embedded = await embedMissing(db, spinner);
		spinner({
			type: "completed",
			message: `Index ready: ${colorize("yellow", normalized.length.toString())} docs (${colorize("green", changed.toString())} new/changed, ${colorize("red", removed.toString())} removed), ${colorize("yellow", embedded.toString())} chunks embedded`,
		});
	});
	return db;
}

function normalizeBody(body: string): string {
	return body.replace(/\r\n/g, "\n").trim();
}

function hashContent(parts: readonly string[]): string {
	return createHash("sha256").update(parts.join(" ")).digest("hex");
}

function normalize(doc: SourceDoc): NormalizedDoc {
	const title = doc.title.trim();
	const url = doc.url.trim();
	const body = normalizeBody(doc.markdown);
	return {
		id: doc.id,
		title,
		url,
		body,
		contentHash: hashContent([title, url, body]),
		lastModified: doc.last_modified ?? null,
	};
}

function toBatches<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
	return Array.from({ length: Math.ceil(items.length / size) }, (_, batch) => items.slice(batch * size, batch * size + size));
}

/** Apply structural changes (new/changed/removed docs), keeping unchanged docs untouched. */
async function applyDiff(
	db: Database,
	normalized: readonly NormalizedDoc[],
	spinner: SpinnerLog,
): Promise<{ readonly changed: number; readonly removed: number }> {
	const currentDocHashes = await getDocHashes(db);
	const desiredIds = new Set(normalized.map((doc) => doc.id));
	const removed = [...currentDocHashes.keys()].filter((id) => !desiredIds.has(id));
	const changed = normalized.filter((doc) => currentDocHashes.get(doc.id) !== doc.contentHash);

	await deleteDocuments(db, removed);
	spinner({ message: `Indexing documents ${colorize("yellow", "0")}/${colorize("yellow", changed.length.toString())}` });
	for (const [index, doc] of changed.entries()) {
		await replaceDocument(db, doc, chunkDoc(doc));
		spinner({
			message: `Indexing documents ${colorize("yellow", (index + 1).toString())}/${colorize("yellow", changed.length.toString())}`,
		});
	}
	return { changed: changed.length, removed: removed.length };
}

/** Embed every chunk that is missing an embedding for the current model. */
async function embedMissing(db: Database, spinner: SpinnerLog): Promise<number> {
	const chunks = await selectChunksToEmbed(db, EMBEDDING_MODEL);
	const batches = toBatches(chunks, EMBED_BATCH_SIZE);
	logger.log({
		message: `Embedding ${colorize("yellow", chunks.length.toString())} chunks in ${colorize("yellow", batches.length.toString())} batches`,
	});
	for (const [batchIndex, batch] of batches.entries()) {
		spinner({
			message: `Batch ${colorize("yellow", batchIndex.toString())}/${colorize("yellow", batches.length.toString())}`,
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
	return chunks.length;
}
