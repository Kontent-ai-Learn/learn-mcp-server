import { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { getOrSetFromMemoryCacheAsync } from "../cache/memory-cache.js";
import { type ApiReferenceCodenames, getDbPath, SEARCH_LIMIT } from "../config.js";
import type { SearchRecordType } from "../content/models/search-records.models.js";
import { openDb } from "../database/db.js";
import { getDocumentsFromDb } from "../database/retrieval.js";
import { embedQuery } from "../indexing/embeddings.js";
import type { SearchResult } from "../indexing/indexer.models.js";

export async function search({
	query,
	type,
	apiReference,
}: {
	readonly query: string;
	readonly type?: SearchRecordType;
	readonly apiReference?: ApiReferenceCodenames;
}): Promise<readonly SearchResult[]> {
	const trimmed = query.trim();

	if (trimmed.length === 0) {
		return [];
	}
	const [db, vector] = await Promise.all([getCachedDb(), embedQuery(trimmed)]);
	return await getDocumentsFromDb({ db, limit: SEARCH_LIMIT, queryVector: vector, type, apiReference });
}

async function getCachedDb(): Promise<Database> {
	return await getOrSetFromMemoryCacheAsync({
		key: "db",
		schema: z.instanceof(Database),
		value: async () => await openDb(getDbPath()),
	});
}
