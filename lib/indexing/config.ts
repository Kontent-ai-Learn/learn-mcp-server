/**
 * Single source of truth for indexing/search configuration. The embedding
 * model + pooling/normalisation MUST be identical at index time and query time,
 * so the model identity lives here and nowhere else.
 */

import { getEnvConfig } from "../utils/environment.utils.js";

/**
 * The recommended transformer model for semantic search
 *
 * https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
 */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

/** How many chunk texts to embed per pipeline call (caps peak memory). */
export const EMBED_BATCH_SIZE = 32;

/** Plain-text chunking: greedily pack paragraphs into windows of this size. */
export const CHUNK_TARGET_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 200;

/** Reciprocal Rank Fusion constant (standard default). */
export const RRF_K = 60;

/** Candidates pulled from each retriever before fusion. */
export const CANDIDATE_LIMIT = 30;

/** Parent documents returned to the caller (bounds the response size). */
export const SEARCH_LIMIT = 5;

/** Persistent Turso DB path; overridable for deployment. */
export const getDbPath = (): string => getEnvConfig().dbPath;

/** transformers.js model cache directory. */
export const getCacheDir = (): string => getEnvConfig().cacheDir;

/** URL of the live content endpoint; when unset, indexing falls back to the bundled sample data. */
export const getContentUrl = (): string | undefined => getEnvConfig().contentUrl;

// Common words carry little lexical signal and inflate generic documents in the
// (IDF-less) term-frequency scorer, so they are dropped from the lexical side.
export const STOPWORDS: ReadonlySet<string> = new Set([
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
