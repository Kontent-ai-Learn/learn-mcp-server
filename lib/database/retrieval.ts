import type { Database } from "@tursodatabase/database";
import { match, P } from "ts-pattern";
import { CANDIDATE_LIMIT, RRF_K, STOPWORDS } from "../indexing/indexer.config.js";
import type { MatchType, SearchResult } from "../indexing/indexer.models.js";
import { selectFrom } from "./db.utils.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

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
