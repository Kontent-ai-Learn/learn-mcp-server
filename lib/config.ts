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

/** Data directory: prod uses DataPath; test artifacts live in the top-level `data-test` folder. */
export const getDataDir = (isTest: boolean): string => (isTest ? "data-test" : getEnvConfig().dataPath);

/** Persistent Turso DB path; overridable for deployment. */
export const getProdDbPath = (): string => `${getDataDir(false)}/search-records-vector.db`;
export const getTestDbPath = (): string => `${getDataDir(true)}/search-records-vector-test.db`;

/** DB path used at query time; the `isTest` env flag selects the test DB. */
export const getDbPath = (): string => (getEnvConfig().isTest ? getTestDbPath() : getProdDbPath());

/** transformers.js model cache: the committed root-level folder, resolved against the process cwd (not `DataPath`). */
export const getTransformersCacheDir = (): string => "transformers";

const composeLearnUrl = (path: string): string => new URL(path, getEnvConfig().learnHost).toString();

/** Learn content endpoint URLs, composed from the configurable `LearnHost` base. */
export const learnUrls = {
	get searchRecordsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getSearchRecords");
	},
	get apiReferenceEndpointsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getApiReferenceEndpoints");
	},
	get apiReferenceObjectsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getApiReferenceObjects");
	},
};
