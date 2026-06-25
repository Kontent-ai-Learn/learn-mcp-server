import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { connect, type Database } from "@tursodatabase/database";
import { CANDIDATE_LIMIT, EMBEDDING_DIM, RRF_K } from "./constants.js";
import type { DocChunk, NormalizedDoc, SearchResult } from "./schema.js";

const DDL = `
CREATE TABLE IF NOT EXISTS documents (
	id            TEXT PRIMARY KEY,
	title         TEXT NOT NULL,
	url           TEXT NOT NULL,
	body          TEXT NOT NULL,
	content_hash  TEXT NOT NULL,
	last_modified TEXT
);
CREATE TABLE IF NOT EXISTS chunks (
	id              INTEGER PRIMARY KEY,
	chunk_key       TEXT NOT NULL UNIQUE,
	doc_id          TEXT NOT NULL,
	chunk_index     INTEGER NOT NULL,
	text            TEXT NOT NULL,
	embedding       F32_BLOB(${EMBEDDING_DIM}),
	embedding_model TEXT
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON chunks USING fts (text);
`;

/** Turso represents a vector literal as a JSON array string passed to vector32(). */
const toVectorParam = (vector: Float32Array): string => JSON.stringify(Array.from(vector));

// Common words carry little lexical signal and inflate generic documents in the
// (IDF-less) term-frequency scorer, so they are dropped from the lexical side.
const STOPWORDS: ReadonlySet<string> = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"can",
	"do",
	"for",
	"from",
	"how",
	"i",
	"in",
	"into",
	"is",
	"it",
	"of",
	"on",
	"or",
	"should",
	"that",
	"the",
	"to",
	"what",
	"when",
	"where",
	"which",
	"with",
	"you",
	"your",
]);

const tokenize = (query: string): readonly string[] =>
	(query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2 && !STOPWORDS.has(token));

export const openStore = async (path: string): Promise<Database> => {
	// Turso does not create the parent directory for a file-based database.
	if (path !== ":memory:") {
		await mkdir(dirname(path), { recursive: true });
	}
	const db = await connect(path, { experimental: ["index_method"] });
	await db.exec(DDL);
	return db;
};

/** Map of document id -> content hash, for change detection. */
export const getDocHashes = async (db: Database): Promise<ReadonlyMap<string, string>> => {
	const stmt = await db.prepare("SELECT id, content_hash FROM documents");
	const rows = (await stmt.all()) as readonly { readonly id: string; readonly content_hash: string }[];
	return new Map(rows.map((row) => [row.id, row.content_hash]));
};

/** Delete documents (and their chunks) that no longer exist in the source. */
export const deleteDocuments = async (db: Database, ids: readonly string[]): Promise<void> => {
	if (ids.length === 0) {
		return;
	}
	const delChunks = await db.prepare("DELETE FROM chunks WHERE doc_id = ?");
	const delDoc = await db.prepare("DELETE FROM documents WHERE id = ?");
	const tx = db.transaction(async (toDelete: readonly string[]) => {
		for (const id of toDelete) {
			await delChunks.run(id);
			await delDoc.run(id);
		}
	});
	await tx(ids);
};

/**
 * Replace a single document and its chunks. New chunks are inserted with a NULL
 * embedding; the embed-missing pass fills them in afterwards.
 */
export const replaceDocument = async (db: Database, doc: NormalizedDoc, chunks: readonly DocChunk[]): Promise<void> => {
	const delChunks = await db.prepare("DELETE FROM chunks WHERE doc_id = ?");
	const delDoc = await db.prepare("DELETE FROM documents WHERE id = ?");
	const insDoc = await db.prepare("INSERT INTO documents (id, title, url, body, content_hash, last_modified) VALUES (?, ?, ?, ?, ?, ?)");
	const insChunk = await db.prepare("INSERT INTO chunks (chunk_key, doc_id, chunk_index, text) VALUES (?, ?, ?, ?)");

	const tx = db.transaction(async () => {
		await delChunks.run(doc.id);
		await delDoc.run(doc.id);
		await insDoc.run(doc.id, doc.title, doc.url, doc.body, doc.contentHash, doc.lastModified);
		for (const chunk of chunks) {
			await insChunk.run(chunk.chunkKey, chunk.docId, chunk.chunkIndex, chunk.text);
		}
	});
	await tx(undefined);
};

/** Chunks whose embedding is missing or was produced by a different model. */
export const selectChunksToEmbed = async (
	db: Database,
	model: string,
): Promise<readonly { readonly chunkKey: string; readonly text: string }[]> => {
	const stmt = await db.prepare("SELECT chunk_key, text FROM chunks WHERE embedding IS NULL OR embedding_model IS NOT ?");
	const rows = (await stmt.all(model)) as readonly { readonly chunk_key: string; readonly text: string }[];
	return rows.map((row) => ({ chunkKey: row.chunk_key, text: row.text }));
};

export const updateEmbeddings = async (
	db: Database,
	model: string,
	items: readonly { readonly chunkKey: string; readonly vector: Float32Array }[],
): Promise<void> => {
	if (items.length === 0) {
		return;
	}
	const upd = await db.prepare("UPDATE chunks SET embedding = vector32(?), embedding_model = ? WHERE chunk_key = ?");
	const tx = db.transaction(async () => {
		for (const item of items) {
			await upd.run(toVectorParam(item.vector), model, item.chunkKey);
		}
	});
	await tx(undefined);
};

type ScoredKey = { readonly chunkKey: string; readonly docId: string };

const vectorCandidates = async (db: Database, queryVector: Float32Array): Promise<readonly ScoredKey[]> => {
	const stmt = await db.prepare(
		`SELECT chunk_key, doc_id, vector_distance_cos(embedding, vector32(?)) AS distance
		 FROM chunks WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ?`,
	);
	const rows = (await stmt.all(toVectorParam(queryVector), CANDIDATE_LIMIT)) as readonly {
		readonly chunk_key: string;
		readonly doc_id: string;
	}[];
	return rows.map((row) => ({ chunkKey: row.chunk_key, docId: row.doc_id }));
};

/**
 * Lexical candidates. Turso's FTS has no usable relevance score (fts_score is a
 * constant), so MATCH is used only to select candidates, which are then ranked
 * app-side by query-term frequency.
 */
const lexicalCandidates = async (db: Database, tokens: readonly string[]): Promise<readonly ScoredKey[]> => {
	if (tokens.length === 0) {
		return [];
	}
	const stmt = await db.prepare("SELECT chunk_key, doc_id, text FROM chunks WHERE text MATCH ? LIMIT ?");
	const rows = (await stmt.all(tokens.join(" "), CANDIDATE_LIMIT * 3)) as readonly {
		readonly chunk_key: string;
		readonly doc_id: string;
		readonly text: string;
	}[];

	return rows
		.map((row) => {
			const haystack = row.text.toLowerCase();
			const score = tokens.reduce((sum, token) => sum + haystack.split(token).length - 1, 0);
			return { chunkKey: row.chunk_key, docId: row.doc_id, score };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, CANDIDATE_LIMIT)
		.map(({ chunkKey, docId }) => ({ chunkKey, docId }));
};

/** Reciprocal Rank Fusion over the two ranked candidate lists. */
const fuse = (
	lists: readonly (readonly ScoredKey[])[],
): { readonly scores: ReadonlyMap<string, number>; readonly docOf: ReadonlyMap<string, string> } => {
	const scores = new Map<string, number>();
	const docOf = new Map<string, string>();
	for (const list of lists) {
		list.forEach((entry, rank) => {
			scores.set(entry.chunkKey, (scores.get(entry.chunkKey) ?? 0) + 1 / (RRF_K + rank + 1));
			docOf.set(entry.chunkKey, entry.docId);
		});
	}
	return { scores, docOf };
};

const rankDocIds = (scores: ReadonlyMap<string, number>, docOf: ReadonlyMap<string, string>, limit: number): readonly string[] => {
	const orderedDocIds = [...scores.entries()]
		.sort(([, a], [, b]) => b - a)
		.map(([chunkKey]) => docOf.get(chunkKey))
		.filter((id): id is string => id !== undefined);
	const seen = new Set<string>();
	const result: string[] = []; // local accumulator (dedupe preserving rank order)
	for (const id of orderedDocIds) {
		if (!seen.has(id) && result.length < limit) {
			seen.add(id);
			result.push(id);
		}
	}
	return result;
};

const getDocuments = async (db: Database, ids: readonly string[]): Promise<ReadonlyMap<string, SearchResult>> => {
	if (ids.length === 0) {
		return new Map();
	}
	const placeholders = ids.map(() => "?").join(", ");
	const stmt = await db.prepare(`SELECT id, title, url, body FROM documents WHERE id IN (${placeholders})`);
	const rows = (await stmt.all(...ids)) as readonly {
		readonly id: string;
		readonly title: string;
		readonly url: string;
		readonly body: string;
	}[];
	return new Map(rows.map((row) => [row.id, { title: row.title, url: row.url, body: row.body }]));
};

/**
 * Hybrid search: fuse semantic (vector) and lexical (FTS) chunk matches with
 * RRF, collapse to parent documents, and return each document's full body.
 */
export const searchHybrid = async (
	db: Database,
	queryVector: Float32Array,
	queryText: string,
	limit: number,
): Promise<readonly SearchResult[]> => {
	const [vector, lexical] = await Promise.all([vectorCandidates(db, queryVector), lexicalCandidates(db, tokenize(queryText))]);
	const { scores, docOf } = fuse([vector, lexical]);
	const docIds = rankDocIds(scores, docOf, limit);
	const documents = await getDocuments(db, docIds);
	return docIds.map((id) => documents.get(id)).filter((doc): doc is SearchResult => doc !== undefined);
};
