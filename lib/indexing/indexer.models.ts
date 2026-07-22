import type { SearchRecordType } from "../content/search-records.js";

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

export type SearchResult = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly codename: string;
	readonly type: SearchRecordType;
	/** Cosine similarity (0–1) of the document's best-matching chunk. */
	readonly score: number;
};
