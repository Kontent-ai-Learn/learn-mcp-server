import { z } from "zod";

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

/**
 * Normalised shape every content source maps to (the live endpoint's segments and the
 * bundled sample data both produce this). Zod is the source of truth; `SourceDoc` is
 * derived via `z.infer`, so the schema const precedes the inferred type.
 */
export const sourceDocSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	url: z.string().min(1), // citation only — never fetched/scraped, so any string (incl. relative) is fine
	body: z.string(), // Markdown (converted from the source HTML)
	last_modified: z.iso.datetime().optional(),
});

export const sourceDocsSchema = z.array(sourceDocSchema);

export type SourceDoc = z.infer<typeof sourceDocSchema>;
