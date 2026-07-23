import type { FileCacheKey } from "../cache/file-cache.js";
import { getApiReferenceObjectsUrl } from "../config.js";
import { initializeLearnEndpointData, readCachedRecords } from "./learn-api.js";
import {
	type ApiReferenceObject,
	apiReferenceObjectSchema,
	apiReferenceObjectsResponseSchema,
} from "./models/api-reference-objects.models.js";

const cacheKey: FileCacheKey = "api-reference-objects";

export async function initializeApiReferenceObjects(): Promise<readonly ApiReferenceObject[]> {
	return await initializeLearnEndpointData({
		url: getApiReferenceObjectsUrl(),
		cacheKey,
		schema: apiReferenceObjectsResponseSchema,
		select: (payload) => payload.data.apiReferenceObjects,
	});
}

export async function getApiReferenceObjectsFromCache(): Promise<readonly ApiReferenceObject[] | undefined> {
	return await readCachedRecords({ cacheKey, schema: apiReferenceObjectSchema });
}
