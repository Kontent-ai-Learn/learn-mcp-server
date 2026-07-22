import { z } from "zod/mini";
import { type FileCacheKey, getFromFileCache } from "../cache/file-cache.js";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { getSearchRecordsUrl } from "../config.js";
import { initializeLearnEndpointData } from "./learn-api.js";

const cacheKey: FileCacheKey = "search-records";

export const searchRecordTypeSchema = z.literal(["endpoint", "section"]);

export type SearchRecordType = z.infer<typeof searchRecordTypeSchema>;

export const searchRecordSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		url: z.url(),
		type: searchRecordTypeSchema,
	}),
);

export type SearchRecord = z.infer<typeof searchRecordSchema>;

const searchRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ searchRecords: z.readonly(z.array(searchRecordSchema)) })),
	}),
);

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
