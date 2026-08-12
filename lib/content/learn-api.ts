import { createFetchQuery, getDefaultHttpService, type JsonValue } from "@kontent-ai/core-sdk";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import { z } from "zod/mini";
import { type FileCacheKey, getFromFileCache, setToFileCache } from "../cache/file-cache.js";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export async function initializeLearnEndpointData<TResponse extends JsonValue, TRecord extends JsonValue>({
	url,
	cacheKey,
	schema,
	recordSchema,
	select,
}: {
	readonly url: string;
	readonly cacheKey: FileCacheKey;
	readonly schema: z.ZodMiniType<TResponse>;
	readonly recordSchema: z.ZodMiniType<TRecord>;
	readonly select: (payload: TResponse) => readonly TRecord[];
}): Promise<readonly TRecord[]> {
	logger.log({ message: `Requesting data from ${url}` });
	const fetchedData = await fetchFromEndpoint(url, schema);

	logger.log({ message: `Successfully fetched data from ${colorize("yellow", url)}` });

	const filename = `${cacheKey}.json`;
	const result = select(fetchedData);

	setToFileCache({
		cacheKey,
		schema: z.readonly(z.array(recordSchema)),
		value: result,
	});

	logger.log({ message: `Data stored in ${colorize("yellow", filename)}` });

	return result;
}

/** Read a cached array of records: memory cache first, falling back to the file cache. */
export async function readCachedRecords<TRecord extends JsonValue>({
	cacheKey,
	schema,
}: {
	readonly cacheKey: FileCacheKey;
	readonly schema: z.ZodMiniType<TRecord>;
}): Promise<readonly TRecord[] | undefined> {
	const recordsSchema = z.readonly(z.array(schema));
	return await getOrSetFromMemoryCache<readonly TRecord[] | undefined>({
		key: cacheKey,
		schema: z.union([recordsSchema, z.undefined()]),
		value: async () => await Promise.resolve(getFromFileCache<readonly TRecord[]>({ cacheKey, schema: recordsSchema })),
	});
}

async function fetchFromEndpoint<TResponse extends JsonValue>(url: string, schema: z.ZodMiniType<TResponse>): Promise<TResponse> {
	const query = createFetchQuery({
		config: {
			httpService: getDefaultHttpService(),
			runtimeValidation: { validateResponses: true },
		},
		mapError: (error) => error,
		mapExtraResponseProps: () => ({}),
		mapMetadata: () => ({}),
		schema,
		sdkInfo: { host: "npmjs.com", name: packageJsonName, version: packageJsonVersion },
		url,
	});
	const { payload } = await query.fetch();

	return payload;
}
