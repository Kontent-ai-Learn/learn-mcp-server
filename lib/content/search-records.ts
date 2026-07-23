import type { FileCacheKey } from "../cache/file-cache.js";
import { getSearchRecordsUrl } from "../config.js";
import { initializeLearnEndpointData, readCachedRecords } from "./learn-api.js";
import { type SearchRecord, searchRecordSchema, searchRecordsResponseSchema } from "./models/search-records.models.js";

const cacheKey: FileCacheKey = "search-records";

export async function initializeSearchRecords(): Promise<readonly SearchRecord[]> {
	return await initializeLearnEndpointData({
		url: getSearchRecordsUrl(),
		cacheKey,
		schema: searchRecordsResponseSchema,
		select: (payload) => payload.data.searchRecords,
	});
}

export async function fetchSearchRecordsFromCache(): Promise<readonly SearchRecord[] | undefined> {
	return await readCachedRecords({ cacheKey, schema: searchRecordSchema });
}
