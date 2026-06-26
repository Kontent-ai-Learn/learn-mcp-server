import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { connect, type Database } from "@tursodatabase/database";
import { match, P } from "ts-pattern";
import { buildCreateTableQuery, deleteFrom, insertInto, selectFrom, updateTable } from "../utils/db-utils.js";
import { CANDIDATE_LIMIT, RRF_K, STOPWORDS } from "./config.js";
import type { DocChunk, MatchType, NormalizedDoc, SearchResult } from "./schema.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE } from "./tables.js";

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
	const [vectorMatches, lexicalMatches] = await Promise.all([
		getVectorCandidates(db, queryVector),
		getLexicalCandidates(db, tokenize(queryText)),
	]);
	const aggregatedScores = calculateScore([
		{ retriever: "vector", candidates: vectorMatches },
		{ retriever: "lexical", candidates: lexicalMatches },
	]);
	const rankedMatches = [...aggregatedScores.entries()].sort(([, a], [, b]) => b.score - a.score).slice(0, limit);
	const documents = await getDocuments({ db, ids: rankedMatches.map(([docId]) => docId) });

	return rankedMatches.flatMap<SearchResult>(([docId, docScore]) => {
		const doc = documents.get(docId);

		if (!doc) {
			return [];
		}
		return {
			...doc,
			matchType: matchTypeOf(docScore),
			score: round(docScore.score, 6),
			scores: {
				vector: docScore.vector === null ? null : round(docScore.vector, 4),
				lexical: docScore.lexical,
			},
		};
	});
}

export async function openDb(path: string): Promise<Database> {
	// Turso does not create the parent directory for a file-based database.
	if (path !== ":memory:") {
		await mkdir(dirname(path), { recursive: true });
	}
	const db = await connect(path, { experimental: ["index_method"] });
	await db.exec(buildCreateTablesQuery());
	return db;
}

/** Map of document id -> content hash, for change detection. */
export async function getDocHashes(db: Database): Promise<ReadonlyMap<string, string>> {
	const rows = await selectFrom(db, { definition: DOCUMENTS_TABLE, columns: ["id", "contentHash"] });
	return new Map(rows.map((row) => [row.id, row.contentHash]));
}

/** Delete documents (and their chunks) that no longer exist in the source. */
export async function deleteDocuments(db: Database, ids: readonly string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}
	const transaction = db.transaction(async (toDelete: readonly string[]) => {
		for (const id of toDelete) {
			await deleteFrom(db, { definition: CHUNKS_TABLE, where: { column: "docId", operator: "=", value: id } });
			await deleteFrom(db, { definition: DOCUMENTS_TABLE, where: { column: "id", operator: "=", value: id } });
		}
	});
	await transaction(ids);
}

/**
 * Replace a single document and its chunks. New chunks are inserted with a NULL
 * embedding; the embed-missing pass fills them in afterwards.
 */
export async function replaceDocument(db: Database, doc: NormalizedDoc, chunks: readonly DocChunk[]): Promise<void> {
	const transaction = db.transaction(async () => {
		await deleteFrom(db, { definition: CHUNKS_TABLE, where: { column: "docId", operator: "=", value: doc.id } });
		await deleteFrom(db, { definition: DOCUMENTS_TABLE, where: { column: "id", operator: "=", value: doc.id } });
		await insertInto(db, {
			definition: DOCUMENTS_TABLE,
			values: {
				id: doc.id,
				title: doc.title,
				url: doc.url,
				body: doc.body,
				contentHash: doc.contentHash,
				lastModified: doc.lastModified,
			},
		});
		for (const chunk of chunks) {
			await insertInto(db, {
				definition: CHUNKS_TABLE,
				values: { chunkKey: chunk.chunkKey, docId: chunk.docId, chunkIndex: chunk.chunkIndex, text: chunk.text },
			});
		}
	});
	await transaction();
}

/** Chunks whose embedding is missing or was produced by a different model. */
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
	const transaction = db.transaction(async () => {
		for (const item of items) {
			await updateTable(db, {
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

function tokenize(query: string): readonly string[] {
	return (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

async function getVectorCandidates(db: Database, queryVector: Float32Array): Promise<readonly Candidate[]> {
	const sql = `SELECT ${CHUNKS_TABLE.columns.chunkKey.name}, ${CHUNKS_TABLE.columns.docId.name}, vector_distance_cos(${CHUNKS_TABLE.columns.embedding.name}, vector32(?)) AS distance
		 FROM ${CHUNKS_TABLE.tableName} WHERE ${CHUNKS_TABLE.columns.embedding.name} IS NOT NULL ORDER BY distance ASC LIMIT ?`;
	const rows = (await db.all(sql, toVectorParam(queryVector), CANDIDATE_LIMIT)) as readonly {
		readonly chunkKey: string;
		readonly docId: string;
		readonly distance: number;
	}[];
	// vector_distance_cos returns 1 - cosineSimilarity, so similarity = 1 - distance.
	return rows.map((row) => ({ chunkKey: row.chunkKey, docId: row.docId, raw: 1 - row.distance }));
}

/**
 * Lexical candidates. Turso's FTS has no usable relevance score (fts_score is a
 * constant), so MATCH is used only to select candidates, which are then ranked
 * app-side by query-term hit count (also returned as the raw lexical score).
 */
async function getLexicalCandidates(db: Database, tokens: readonly string[]): Promise<readonly Candidate[]> {
	if (tokens.length === 0) {
		return [];
	}
	const sql = `SELECT ${CHUNKS_TABLE.columns.chunkKey.name}, ${CHUNKS_TABLE.columns.docId.name}, ${CHUNKS_TABLE.columns.text.name} FROM ${CHUNKS_TABLE.tableName} WHERE ${CHUNKS_TABLE.columns.text.name} MATCH ? LIMIT ?`;
	const rows = (await db.all(sql, tokens.join(" "), CANDIDATE_LIMIT * 3)) as readonly {
		readonly chunkKey: string;
		readonly docId: string;
		readonly text: string;
	}[];

	return rows
		.map((row) => {
			const haystack = row.text.toLowerCase();
			const hits = tokens.reduce((sum, token) => sum + haystack.split(token).length - 1, 0);
			return { chunkKey: row.chunkKey, docId: row.docId, raw: hits };
		})
		.sort((a, b) => b.raw - a.raw)
		.slice(0, CANDIDATE_LIMIT);
}

/**
 * Aggregate candidate chunks to the document level: sum each retriever's RRF
 * contribution into the doc's fused score, and keep the best raw per-retriever
 * score for the breakdown.
 */
function calculateScore(lists: readonly RankedList[]): ReadonlyMap<string, DocScore> {
	const result = new Map<string, DocScore>();
	for (const { retriever, candidates } of lists) {
		candidates.forEach((candidate, rank) => {
			const prev = result.get(candidate.docId) ?? { score: 0, vector: null, lexical: null };
			const best = (current: number | null): number => (current === null ? candidate.raw : Math.max(current, candidate.raw));
			result.set(candidate.docId, {
				score: prev.score + 1 / (RRF_K + rank + 1),
				vector: retriever === "vector" ? best(prev.vector) : prev.vector,
				lexical: retriever === "lexical" ? best(prev.lexical) : prev.lexical,
			});
		});
	}
	return result;
}

function matchTypeOf({ vector, lexical }: DocScore): MatchType {
	return match({ vector, lexical })
		.returnType<MatchType>()
		.with({ vector: P.nonNullable, lexical: P.nonNullable }, () => "hybrid")
		.with({ vector: P.nonNullable }, () => "vector")
		.with({ lexical: P.nonNullable }, () => "lexical")
		.otherwise(() => {
			throw new Error("Invalid score type");
		});
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
	const rows = await selectFrom(db, {
		definition: DOCUMENTS_TABLE,
		columns: ["id", "title", "url", "body"],
		where: { column: "id", operator: "IN", values: ids },
	});
	return new Map(rows.map((row) => [row.id, { title: row.title, url: row.url, body: row.body }]));
}

function buildCreateIndexesQuery(): string {
	return `
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON ${CHUNKS_TABLE.tableName}(${CHUNKS_TABLE.columns.docId.name});
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON ${CHUNKS_TABLE.tableName} USING fts (${CHUNKS_TABLE.columns.text.name});`;
}

function buildCreateTablesQuery(): string {
	return [buildCreateTableQuery(DOCUMENTS_TABLE), buildCreateTableQuery(CHUNKS_TABLE), buildCreateIndexesQuery()].join("\n");
}

/** Turso represents a vector literal as a JSON array string passed to vector32(). */
const toVectorParam = (vector: Float32Array): string => JSON.stringify(Array.from(vector));
