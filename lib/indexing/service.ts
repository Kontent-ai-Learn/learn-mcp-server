import type { Database } from "@tursodatabase/database";
import { getDbPath, SEARCH_LIMIT } from "./config.js";
import { embedQuery } from "./embeddings.js";
import type { SearchResult } from "./schema.js";
import { openStore, searchHybrid } from "./store.js";
import { syncIndex } from "./sync.js";

/**
 * Process-level singleton. The index (Turso connection + populated data) is
 * built exactly once per process and shared by every request. Held on a const
 * object so concurrent callers await the same initialisation promise.
 *
 * IMPORTANT: never initialise inside `createServer` — that runs per HTTP
 * request. Initialise once in `main()` via `ensureIndexReady`.
 */
const state: { ready: Promise<Database> | null } = { ready: null };

/** Idempotent: opens the DB and runs the incremental sync on first call only. */
export async function ensureIndexReady(): Promise<Database> {
	state.ready ??= initOnce();
	return await state.ready;
}

/** Hybrid search over the indexed documentation, returning full parent documents. */
export async function search(query: string): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const db = await ensureIndexReady();
	const vector = await embedQuery(trimmed);
	return searchHybrid({ db, queryVector: vector, queryText: trimmed, limit: SEARCH_LIMIT });
}

async function initOnce(): Promise<Database> {
	const db = await openStore(getDbPath());
	await syncIndex(db);
	return db;
}
