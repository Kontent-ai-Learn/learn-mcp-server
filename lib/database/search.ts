import type { Database } from "@tursodatabase/database";
import { embedQuery } from "../indexing/embeddings.js";
import { getDbPath, SEARCH_LIMIT } from "../indexing/indexer.config.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import { openDb } from "./db.js";
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
