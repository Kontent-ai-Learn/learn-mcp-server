import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { connect, type Database } from "@tursodatabase/database";
import { CANDIDATE_LIMIT, EMBEDDING_DIM, RRF_K } from "./constants.js";
import type { DocChunk, MatchType, NormalizedDoc, SearchResult } from "./schema.js";

type DocRecord = { readonly title: string; readonly url: string; readonly body: string };

type Retriever = "vector" | "lexical";

/** A chunk that matched a retriever, carrying that retriever's raw score. */
type Candidate = { readonly chunkKey: string; readonly docId: string; readonly raw: number };

/** A ranked candidate list paired with the retriever that produced it. */
type RankedList = { readonly retriever: Retriever; readonly candidates: readonly Candidate[] };

/** Per-document fused score plus the best raw score from each retriever. */
type DocScore = {
	readonly score: number; // fused Reciprocal Rank Fusion score
	readonly vector: number | null; // best cosine similarity across the doc's vector matches
	readonly lexical: number | null; // best term-hit count across the doc's lexical matches
};

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

/**
 * Hybrid search: fuse semantic (vector) and lexical (FTS) chunk matches with
 * RRF, collapse to parent documents, and return each document's full body
 * annotated with how it matched (`matchType`), the fused `score`, and the raw
 * per-retriever `scores`.
 */
export async function searchHybrid({
	db,
	queryVector,
	queryText,
	limit,
}: {
	readonly db: Database;
	readonly queryVector: Float32Array;
	readonly queryText: string;
	readonly limit: number;
}): Promise<readonly SearchResult[]> {
	const [vector, lexical] = await Promise.all([vectorCandidates(db, queryVector), lexicalCandidates(db, tokenize(queryText))]);
	const docScores = aggregate([
		{ retriever: "vector", candidates: vector },
		{ retriever: "lexical", candidates: lexical },
	]);
	const ranked = [...docScores.entries()].sort(([, a], [, b]) => b.score - a.score).slice(0, limit);
	const documents = await getDocuments({ db, ids: ranked.map(([docId]) => docId) });

	return ranked.flatMap<SearchResult>(([docId, docScore]) => {
		const doc = documents.get(docId);
		return doc === undefined
			? []
			: [
					{
						...doc,
						matchType: matchTypeOf(docScore),
						score: round(docScore.score, 6),
						scores: {
							vector: docScore.vector === null ? null : round(docScore.vector, 4),
							lexical: docScore.lexical,
						},
					},
				];
	});
}

export async function openStore(path: string): Promise<Database> {
	// Turso does not create the parent directory for a file-based database.
	if (path !== ":memory:") {
		await mkdir(dirname(path), { recursive: true });
	}
	const db = await connect(path, { experimental: ["index_method"] });
	await db.exec(DDL);
	return db;
}

/** Map of document id -> content hash, for change detection. */
export async function getDocHashes(db: Database): Promise<ReadonlyMap<string, string>> {
	const stmt = await db.prepare("SELECT id, content_hash FROM documents");
	const rows = (await stmt.all()) as readonly { readonly id: string; readonly content_hash: string }[];
	return new Map(rows.map((row) => [row.id, row.content_hash]));
}

/** Delete documents (and their chunks) that no longer exist in the source. */
export async function deleteDocuments(db: Database, ids: readonly string[]): Promise<void> {
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
}

/**
 * Replace a single document and its chunks. New chunks are inserted with a NULL
 * embedding; the embed-missing pass fills them in afterwards.
 */
export async function replaceDocument(db: Database, doc: NormalizedDoc, chunks: readonly DocChunk[]): Promise<void> {
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
}

/** Chunks whose embedding is missing or was produced by a different model. */
export async function selectChunksToEmbed(
	db: Database,
	model: string,
): Promise<readonly { readonly chunkKey: string; readonly text: string }[]> {
	const stmt = await db.prepare("SELECT chunk_key, text FROM chunks WHERE embedding IS NULL OR embedding_model IS NOT ?");
	const rows = (await stmt.all(model)) as readonly { readonly chunk_key: string; readonly text: string }[];
	return rows.map((row) => ({ chunkKey: row.chunk_key, text: row.text }));
}

export async function updateEmbeddings(
	db: Database,
	model: string,
	items: readonly { readonly chunkKey: string; readonly vector: Float32Array }[],
): Promise<void> {
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
}

function tokenize(query: string): readonly string[] {
	return (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

async function vectorCandidates(db: Database, queryVector: Float32Array): Promise<readonly Candidate[]> {
	const stmt = await db.prepare(
		`SELECT chunk_key, doc_id, vector_distance_cos(embedding, vector32(?)) AS distance
		 FROM chunks WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ?`,
	);
	const rows = (await stmt.all(toVectorParam(queryVector), CANDIDATE_LIMIT)) as readonly {
		readonly chunk_key: string;
		readonly doc_id: string;
		readonly distance: number;
	}[];
	// vector_distance_cos returns 1 - cosineSimilarity, so similarity = 1 - distance.
	return rows.map((row) => ({ chunkKey: row.chunk_key, docId: row.doc_id, raw: 1 - row.distance }));
}

/**
 * Lexical candidates. Turso's FTS has no usable relevance score (fts_score is a
 * constant), so MATCH is used only to select candidates, which are then ranked
 * app-side by query-term hit count (also returned as the raw lexical score).
 */
async function lexicalCandidates(db: Database, tokens: readonly string[]): Promise<readonly Candidate[]> {
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
			const hits = tokens.reduce((sum, token) => sum + haystack.split(token).length - 1, 0);
			return { chunkKey: row.chunk_key, docId: row.doc_id, raw: hits };
		})
		.sort((a, b) => b.raw - a.raw)
		.slice(0, CANDIDATE_LIMIT);
}

/**
 * Aggregate candidate chunks to the document level: sum each retriever's RRF
 * contribution into the doc's fused score, and keep the best raw per-retriever
 * score for the breakdown.
 */
function aggregate(lists: readonly RankedList[]): ReadonlyMap<string, DocScore> {
	const acc = new Map<string, DocScore>();
	for (const { retriever, candidates } of lists) {
		candidates.forEach((candidate, rank) => {
			const prev = acc.get(candidate.docId) ?? { score: 0, vector: null, lexical: null };
			const best = (current: number | null): number => (current === null ? candidate.raw : Math.max(current, candidate.raw));
			acc.set(candidate.docId, {
				score: prev.score + 1 / (RRF_K + rank + 1),
				vector: retriever === "vector" ? best(prev.vector) : prev.vector,
				lexical: retriever === "lexical" ? best(prev.lexical) : prev.lexical,
			});
		});
	}
	return acc;
}

function matchTypeOf({ vector, lexical }: DocScore): MatchType {
	return vector !== null && lexical !== null ? "hybrid" : vector !== null ? "vector" : "lexical";
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

async function getDocuments({
	db,
	ids,
}: {
	readonly db: Database;
	readonly ids: readonly string[];
}): Promise<ReadonlyMap<string, DocRecord>> {
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
}
