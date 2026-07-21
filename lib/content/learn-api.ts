import { createFetchQuery, getDefaultHttpService, type JsonValue } from "@kontent-ai/core-sdk";
import type { z } from "zod/mini";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export async function fetchFromEndpoint<TResponse extends JsonValue, TResult>(
	url: string,
	schema: z.ZodMiniType<TResponse>,
	select: (payload: TResponse) => TResult,
): Promise<TResult> {
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

	return select(payload);
}
