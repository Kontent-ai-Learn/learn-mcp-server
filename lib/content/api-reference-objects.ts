import type { FileCacheKey } from "../cache/file-cache.js";
import { learnUrls } from "../config.js";
import { initializeLearnEndpointData, readCachedRecords } from "./learn-api.js";
import {
	type ApiReferenceObject,
	apiReferenceObjectSchema,
	apiReferenceObjectsResponseSchema,
} from "./models/api-reference-objects.models.js";

const cacheKey: FileCacheKey = "api-reference-objects";

export async function initializeApiReferenceObjects(): Promise<readonly ApiReferenceObject[]> {
	return await initializeLearnEndpointData({
		cacheKey,
		recordSchema: apiReferenceObjectSchema,
		schema: apiReferenceObjectsResponseSchema,
		select: (payload) => payload.data.apiReferenceObjects,
		url: learnUrls.apiReferenceObjectsUrl,
	});
}

export function getApiReferenceObjectsFromCache(): readonly ApiReferenceObject[] | undefined {
	return readCachedRecords({ cacheKey, schema: apiReferenceObjectSchema });
}
