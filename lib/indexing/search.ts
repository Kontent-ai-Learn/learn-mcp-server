import type { Database } from "@tursodatabase/database";
import { logger } from "../utils/logger.js";
import { getDbPath, SEARCH_LIMIT } from "./config.js";
import { loadSourceDocs } from "./data.js";
import { openDb, searchHybrid } from "./db.js";
import { indexSourceDocuments } from "./documents.js";
import { embedQuery } from "./embeddings.js";
import type { SearchResult } from "./schema.js";

let cachedDb: Database | null = null;
type SyncDbResult = {
	readonly documentCount: number;
	readonly database: Database;
};

export async function getCachedDb(): Promise<Database> {
	if (!cachedDb) {
		cachedDb = await getDb();
	}
	return cachedDb;
}

export async function search(query: string): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}
	const db = await getCachedDb();
	const vector = await embedQuery(trimmed);
	return await searchHybrid({ db, queryVector: vector, queryText: trimmed, limit: SEARCH_LIMIT });
}

export async function syncDatabase(): Promise<SyncDbResult> {
	const { success, error, data: documents } = await loadSourceDocs();

	if (!success) {
		logger.log({
			message: `Failed to load source documents when syncing database. ${error instanceof Error ? error.message : "Unknown error"}`,
		});
		throw error;
	}
	const db = await indexSourceDocuments(await getDb(), documents);

	return {
		documentCount: documents.length,
		database: db,
	};
}

async function getDb(): Promise<Database> {
	return await openDb(getDbPath());
}
