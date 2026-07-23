import type { FileCacheKey } from "../cache/file-cache.js";
import { getApiReferenceRecordsUrl } from "../config.js";
import { initializeLearnEndpointData, readCachedRecords } from "./learn-api.js";
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
	return await readCachedRecords({ cacheKey, schema: apiReferenceRecordSchema });
}
