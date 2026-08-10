import type { FileCacheKey } from "../cache/file-cache.js";
import { learnUrls } from "../config.js";
import { initializeLearnEndpointData } from "./learn-api.js";
import { type SearchRecord, searchRecordsResponseSchema } from "./models/search-records.models.js";

const cacheKey: FileCacheKey = "search-records";

export async function initializeSearchRecords(): Promise<readonly SearchRecord[]> {
	return await initializeLearnEndpointData({
		cacheKey,
		schema: searchRecordsResponseSchema,
		select: (payload) => payload.data.searchRecords,
		url: learnUrls.searchRecordsUrl,
	});
}
