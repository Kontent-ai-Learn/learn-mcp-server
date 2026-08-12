import type { FileCacheKey } from "../cache/file-cache.js";
import { learnUrls } from "../config.js";
import { initializeLearnEndpointData, readCachedRecords } from "./learn-api.js";
import {
	type ApiReferenceEndpoint,
	apiReferenceEndpointSchema,
	apiReferenceEndpointsResponseSchema,
} from "./models/api-reference-endpoints.models.js";

const cacheKey: FileCacheKey = "api-reference-endpoints";

export async function initializeApiReferenceEndpoints(): Promise<readonly ApiReferenceEndpoint[]> {
	return await initializeLearnEndpointData({
		cacheKey,
		recordSchema: apiReferenceEndpointSchema,
		schema: apiReferenceEndpointsResponseSchema,
		select: (payload) => payload.data.apiReferenceEndpoints,
		url: learnUrls.apiReferenceEndpointsUrl,
	});
}

export async function getApiReferenceEndpointsFromCache(): Promise<readonly ApiReferenceEndpoint[] | undefined> {
	return await readCachedRecords({ cacheKey, schema: apiReferenceEndpointSchema });
}
