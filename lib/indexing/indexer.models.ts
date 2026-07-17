export type NormalizedDoc = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly codename: string;
};

export type DocChunk = {
	readonly chunkKey: string; // `${docId}:${chunkIndex}`
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
};

export type MatchType = "vector" | "lexical" | "hybrid";

export type EndpointReference = {
	readonly endpointUrl: string;
	readonly endpointName: string;
	readonly endpointMethod: string;
};

export type SearchResult = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly endpoint: EndpointReference | null;
	readonly matchType: MatchType;
	readonly score: number;
	readonly scores: {
		/** Cosine similarity (0–1); `null` if no vector match. */
		readonly vector: number | null;
		/** Term-hit count; `null` if no lexical match. */
		readonly lexical: number | null;
	};
};
