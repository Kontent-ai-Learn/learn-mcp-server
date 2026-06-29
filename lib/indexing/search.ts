import type { Database } from "@tursodatabase/database";
import { getDbPath, SEARCH_LIMIT } from "./config.js";
import { openDb, searchHybrid } from "./db.js";
import { embedQuery } from "./embeddings.js";
import type { SearchResult } from "./schema.js";
import { syncIndex } from "./sync.js";

/**
 * Process-level singleton. The index (Turso connection + populated data) is
 * built exactly once per process and shared by every request. Held on a const
 * object so concurrent callers await the same initialisation promise.
 *
 * IMPORTANT: never initialise inside `createServer` — that runs per HTTP
 * request. Initialise once in `main()` via `ensureIndexReady`.
 */
let cachedDb: Database | null = null;

export async function ensureIndexReady(): Promise<Database> {
	if (!cachedDb) {
		cachedDb = await prepareDb();
	}
	return cachedDb;
}

export async function search(query: string): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const db = await ensureIndexReady();
	const vector = await embedQuery(trimmed);
	return await searchHybrid({ db, queryVector: vector, queryText: trimmed, limit: SEARCH_LIMIT });
}

async function prepareDb(): Promise<Database> {
	const db = await openDb(getDbPath());
	await syncIndex(db);
	return db;
}
