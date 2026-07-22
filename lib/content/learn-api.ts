import { createFetchQuery, getDefaultHttpService, type JsonValue } from "@kontent-ai/core-sdk";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { z } from "zod/mini";
import { type FileCacheKey, setToFileCache } from "../cache/file-cache.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export async function initializeLearnEndpointData<TResponse extends JsonValue, TResult>({
	url,
	cacheKey,
	schema,
	select,
}: {
	readonly url: string;
	readonly cacheKey: FileCacheKey;
	readonly schema: z.ZodMiniType<TResponse>;
	readonly select: (payload: TResponse) => TResult;
}): Promise<TResult> {
	logger.log({ message: `Requesting data from ${url}` });
	const fetchedData = await fetchFromEndpoint(url, schema);

	logger.log({ message: `Successfully fetched data from ${colorize("yellow", url)}` });

	const filename = `${cacheKey}.json`;

	setToFileCache({
		cacheKey,
		value: fetchedData,
		schema: schema,
	});

	logger.log({ message: `Data stored in ${colorize("yellow", filename)}` });

	return select(fetchedData);
}

async function fetchFromEndpoint<TResponse extends JsonValue>(url: string, schema: z.ZodMiniType<TResponse>): Promise<TResponse> {
	const query = createFetchQuery({
		url,
		config: {
			httpService: getDefaultHttpService(),
			runtimeValidation: { validateResponses: true },
		},
		schema,
		sdkInfo: { name: packageJsonName, version: packageJsonVersion, host: "npmjs.com" },
		mapMetadata: () => ({}),
		mapError: (error) => error,
		mapExtraResponseProps: () => ({}),
	});
	const { payload } = await query.fetch();

	return payload;
}
