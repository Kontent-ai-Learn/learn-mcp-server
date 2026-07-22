import { z } from "zod/mini";
import { type FileCacheKey, getFromFileCache } from "../cache/file-cache.js";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { getSearchRecordsUrl } from "../config.js";
import { initializeLearnEndpointData } from "./learn-api.js";
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
	return await getOrSetFromMemoryCache<readonly SearchRecord[] | undefined>({
		key: cacheKey,
		schema: z.union([z.readonly(z.array(searchRecordSchema)), z.undefined()]),
		value: async () => {
			const dataFromCache = getFromFileCache<readonly SearchRecord[]>({
				cacheKey,
				schema: z.readonly(z.array(searchRecordSchema)),
			});

			return await Promise.resolve(dataFromCache);
		},
	});
}
