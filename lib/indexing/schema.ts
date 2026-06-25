import { z } from "zod";

/**
 * Shape of a single source document. The Zod schema is the source of truth;
 * all types are derived via `z.infer`.
 *
 * NOTE: these field names match the bundled sample data. When `loadSourceDocs`
 * is switched to a real export (remote JSON / Kontent.ai Delivery API), adjust
 * this schema (and wrap with `{ items: [...] }` if the export is not a
 * top-level array).
 */
export const sourceDocSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	url: z.url(), // citation only — never fetched/scraped
	body: z.string(), // plain text
	last_modified: z.iso.datetime().optional(),
});

export const sourceDocsSchema = z.array(sourceDocSchema);

export type SourceDoc = z.infer<typeof sourceDocSchema>;

/** A source document after normalisation, with a content hash for change detection. */
export type NormalizedDoc = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly lastModified: string | null;
};

/** A retrieval-sized slice of a document. */
export type DocChunk = {
	readonly chunkKey: string; // `${docId}:${chunkIndex}`
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
};

/** Which retriever(s) surfaced a document. */
export type MatchType = "vector" | "lexical" | "hybrid";

/** What the search tool returns per matched parent document. */
export type SearchResult = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	/** Which retriever(s) matched: semantic, lexical, or both. */
	readonly matchType: MatchType;
	/** Fused Reciprocal Rank Fusion score used for ranking (higher = better). */
	readonly score: number;
	/** Raw per-retriever scores; `null` when that retriever did not match. */
	readonly scores: {
		/** Cosine similarity (0–1); `null` if no vector match. */
		readonly vector: number | null;
		/** Term-hit count; `null` if no lexical match. */
		readonly lexical: number | null;
	};
};
