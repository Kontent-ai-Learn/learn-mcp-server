import type { SearchRecordType } from "../content/models/search-records.models.js";

export type NormalizedDoc = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly codename: string;
	readonly type: SearchRecordType;
	readonly apiReference: string | null;
};

export type DocChunk = {
	// `${docId}:${chunkIndex}`
	readonly chunkKey: string;
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
};

export type SearchResult = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly codename: string;
	readonly type: SearchRecordType;
	/** Cosine similarity (0–1) of the document's best-matching chunk. */
	readonly score: number;
};
