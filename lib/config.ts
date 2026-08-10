import { Duration } from "luxon";
import { match } from "ts-pattern";
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

/** Persistent Turso DB path */
export const getProdDbPath = (): string => `${getDataDir(false)}/search-records-vector.db`;
export const getTestDbPath = (): string => `${getDataDir(true)}/search-records-vector-test.db`;

/** Path to the persisted sync-state file (last run of any sync trigger — auto, manual, or CLI). */
export const getSyncStatePath = (): string => `${getDataDir(getEnvConfig().isTest)}/sync.json`;

/** How often the auto-sync loop runs, from `SyncIntervalValue`/`SyncIntervalUnit`. */
export const getSyncInterval = (): Duration => {
	const { syncIntervalValue, syncIntervalUnit } = getEnvConfig();
	return match(syncIntervalUnit)
		.with("minutes", () => Duration.fromObject({ minutes: syncIntervalValue }))
		.with("hours", () => Duration.fromObject({ hours: syncIntervalValue }))
		.with("days", () => Duration.fromObject({ days: syncIntervalValue }))
		.exhaustive();
};

/** DB path used at query time; the `isTest` env flag selects the test DB. */
export const getDbPath = (): string => (getEnvConfig().isTest ? getTestDbPath() : getProdDbPath());

/** Transformers.js model cache folder name — committed at the repo root; the transformers.js runtime resolves it relative to cwd, not tied to `DataPath`. */
export const getTransformersCacheDir = (): string => "transformers";

const composeLearnUrl = (path: string): string => new URL(path, getEnvConfig().learnHost).toString();

/** Learn content endpoint URLs, composed from the configurable `LearnHost` base. */
export const learnUrls = {
	get apiReferenceEndpointsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getApiReferenceEndpoints");
	},
	get apiReferenceObjectsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getApiReferenceObjects");
	},
	get searchRecordsUrl(): string {
		return composeLearnUrl("/learn/api/mcp/getSearchRecords");
	},
};
