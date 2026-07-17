import type { SearchRecordType } from "../data/learn-api.js";

export type NormalizedDoc = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly codename: string;
	readonly type: SearchRecordType;
};

export type DocChunk = {
	readonly chunkKey: string; // `${docId}:${chunkIndex}`
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
};

export type MatchType = "vector" | "lexical" | "hybrid";

export type SearchResult = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly codename: string;
	readonly matchType: MatchType;
	readonly type: SearchRecordType;
	readonly score: number;
	readonly scores: {
		/** Cosine similarity (0–1); `null` if no vector match. */
		readonly vector: number | null;
		/** Term-hit count; `null` if no lexical match. */
		readonly lexical: number | null;
	};
};
