import type { Database } from "@tursodatabase/database";
import { getDbPath, SEARCH_LIMIT } from "./config.js";
import { openDb } from "./db.js";
import { embedQuery } from "./embeddings.js";
import type { SearchResult } from "./models.js";
import { searchHybrid } from "./retrieval.js";

/** Lazily-opened, process-wide DB handle reused across queries. */
const state: { db: Database | null } = { db: null };

export async function search(query: string): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const db = await getCachedDb();
	const vector = await embedQuery(trimmed);
	return await searchHybrid({ db, queryVector: vector, queryText: trimmed, limit: SEARCH_LIMIT });
}

async function getCachedDb(): Promise<Database> {
	state.db ??= await openDb(getDbPath());
	return state.db;
}
