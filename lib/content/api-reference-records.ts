import { z } from "zod/mini";
import { type FileCacheKey, getFromFileCache } from "../cache/file-cache.js";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { getApiReferenceRecordsUrl } from "../config.js";
import { initializeLearnEndpointData } from "./learn-api.js";
import {
	type ApiReferenceRecord,
	apiReferenceRecordSchema,
	apiReferenceRecordsResponseSchema,
} from "./models/api-reference-records.models.js";

const cacheKey: FileCacheKey = "api-reference-records";

export async function initializeApiReferenceRecords(): Promise<readonly ApiReferenceRecord[]> {
	return await initializeLearnEndpointData({
		url: getApiReferenceRecordsUrl(),
		cacheKey,
		schema: apiReferenceRecordsResponseSchema,
		select: (payload) => payload.data.apiReferenceRecords,
	});
}

export async function getApiReferenceRecordsFromCache(): Promise<readonly ApiReferenceRecord[] | undefined> {
	return await getOrSetFromMemoryCache<readonly ApiReferenceRecord[] | undefined>({
		key: cacheKey,
		schema: z.union([z.readonly(z.array(apiReferenceRecordSchema)), z.undefined()]),
		value: async () => {
			const dataFromCache = getFromFileCache<readonly ApiReferenceRecord[]>({
				cacheKey,
				schema: z.readonly(z.array(apiReferenceRecordSchema)),
			});

			return await Promise.resolve(dataFromCache);
		},
	});
}
