import { createHash } from "node:crypto";
import type { Database } from "@tursodatabase/database";
import { chunkDoc } from "./chunking.js";
import { EMBED_BATCH_SIZE, EMBEDDING_MODEL } from "./config.js";
import { deleteDocuments, getDocHashes, replaceDocument, selectChunksToEmbed, updateEmbeddings } from "./db.js";
import { embedTexts } from "./embeddings.js";
import type { NormalizedDoc, SourceDoc } from "./schema.js";
import { loadSourceDocs } from "./source.js";

/**
 * Bring the index up to date with the source: diff by content hash, re-chunk
 * changed docs, then embed any chunk lacking an embedding. Persistent +
 * incremental — unchanged docs keep their existing embeddings across restarts.
 */
export async function syncIndex(db: Database): Promise<void> {
	log("⏳ Indexing documentation…");
	const normalized = (await loadSourceDocs()).map(normalize);
	const { changed, removed } = await applyDiff(db, normalized);
	const embedded = await embedMissing(db);
	log(`✅ Index ready: ${normalized.length} docs (${changed} new/changed, ${removed} removed), ${embedded} chunks embedded`);
}

/** Indexing logs go to stderr so they never corrupt the stdio JSON-RPC stream. */
function log(message: string): void {
	console.error(message);
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
	const body = normalizeBody(doc.body);
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
): Promise<{ readonly changed: number; readonly removed: number }> {
	const existing = await getDocHashes(db);
	const desiredIds = new Set(normalized.map((doc) => doc.id));
	const removed = [...existing.keys()].filter((id) => !desiredIds.has(id));
	const changed = normalized.filter((doc) => existing.get(doc.id) !== doc.contentHash);

	await deleteDocuments(db, removed);
	for (const doc of changed) {
		await replaceDocument(db, doc, chunkDoc(doc));
	}
	return { changed: changed.length, removed: removed.length };
}

/** Embed every chunk that is missing an embedding for the current model. */
async function embedMissing(db: Database): Promise<number> {
	const pending = await selectChunksToEmbed(db, EMBEDDING_MODEL);
	for (const batch of toBatches(pending, EMBED_BATCH_SIZE)) {
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
	return pending.length;
}
