import { z } from "zod/mini";
import { type FileCacheKey, getFromFileCache } from "../cache/file-cache.js";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { getApiReferenceRecordsUrl } from "../config.js";
import { initializeLearnEndpointData } from "./learn-api.js";

const cacheKey: FileCacheKey = "api-reference-records";

export type ApiReferenceProperty = {
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly modifiers: readonly string[];
	readonly nestedProperties: readonly ApiReferenceProperty[];
};

// Hand-written type + explicit annotation break the self-reference cycle that TS
// cannot infer; the getter defers evaluation until the const is initialised.
export const apiReferencePropertySchema: z.ZodMiniType<ApiReferenceProperty> = z.readonly(
	z.object({
		name: z.string(),
		description: z.string(),
		type: z.string(),
		modifiers: z.readonly(z.array(z.string())),
		get nestedProperties() {
			return z.readonly(z.array(apiReferencePropertySchema));
		},
	}),
);

export const apiReferenceCodeSampleSchema = z.readonly(
	z.object({
		language: z.string(),
		code: z.string(),
	}),
);

export type ApiReferenceCodeSample = z.infer<typeof apiReferenceCodeSampleSchema>;

export const apiReferenceResponseSchema = z.readonly(
	z.object({
		statusCode: z.number(),
		description: z.string(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		samples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
	}),
);

export type ApiReferenceResponse = z.infer<typeof apiReferenceResponseSchema>;

export const apiReferenceRecordSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		httpMethod: z.string(),
		url: z.optional(z.url()),
		endpointUrls: z.readonly(z.array(z.string())),
		queryParameters: z.readonly(z.array(apiReferencePropertySchema)),
		headerParameters: z.readonly(z.array(apiReferencePropertySchema)),
		endpointParameters: z.readonly(z.array(apiReferencePropertySchema)),
		bodyParameters: z.readonly(z.array(apiReferencePropertySchema)),
		tags: z.readonly(z.array(z.string())),
		usageCodeSamples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
		responses: z.readonly(z.array(apiReferenceResponseSchema)),
	}),
);

export type ApiReferenceRecord = z.infer<typeof apiReferenceRecordSchema>;

const apiReferenceRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceRecords: z.readonly(z.array(apiReferenceRecordSchema)) })),
	}),
);

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
