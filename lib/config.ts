import { getEnvConfig } from "./utils/environment.utils.js";

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

/** Parent documents returned to the caller (bounds the response size). */
export const SEARCH_LIMIT = 10;

/** Persistent Turso DB path; overridable for deployment. */
export const getProdDbPath = (): string => `${getEnvConfig().dataPath}/search-records-vector.db`;
export const getTestDbPath = (): string => `${getEnvConfig().dataPath}/search-records-vector-test.db`;

/** DB path used at query time; the `isTest` env flag selects the test DB. */
export const getDbPath = (): string => (getEnvConfig().isTest ? getTestDbPath() : getProdDbPath());

/** transformers.js model cache directory. */
export const getTransformersCacheDir = (): string => getEnvConfig().cacheDir;

export const getSearchRecordsUrl = (): string => {
	const {
		learnUrls: { searchRecordsUrl },
	} = getEnvConfig();
	return searchRecordsUrl;
};

/** Full URL of the API-reference-records endpoint, composed from `LearnHost` + path */
export const getApiReferenceRecordsUrl = (): string => {
	const {
		learnUrls: { apiReferenceRecordsUrl },
	} = getEnvConfig();
	return apiReferenceRecordsUrl;
};
