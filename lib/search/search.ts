import { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { getDbPath, SEARCH_LIMIT } from "../config.js";
import { openDb } from "../database/db.js";
import { getDocumentsFromDb } from "../database/retrieval.js";
import { embedQuery } from "../indexing/embeddings.js";
import type { SearchResult } from "../indexing/indexer.models.js";

export async function search(query: string): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const db = await getCachedDb();
	const vector = await embedQuery(trimmed);
	return await getDocumentsFromDb({ db, limit: SEARCH_LIMIT, queryVector: vector });
}

async function getCachedDb(): Promise<Database> {
	return await getOrSetFromMemoryCache({
		key: "db",
		schema: z.instanceof(Database),
		value: async () => await openDb(getDbPath()),
	});
}
