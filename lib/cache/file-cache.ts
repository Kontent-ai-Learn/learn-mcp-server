import type { JsonValue } from "@kontent-ai/core-sdk";
import type { ZodMiniType } from "zod/mini";
import { getDataDir } from "../config.js";
import { getEnvConfig } from "../utils/environment.utils.js";
import { existsSync, readFileSync, writeFileSync } from "../utils/file.utils.js";

export type FileCacheKey = `api-reference-endpoints` | `api-reference-objects` | `search-records`;

export function setToFileCache<T extends JsonValue>({
	cacheKey,
	value,
	schema,
}: {
	readonly cacheKey: FileCacheKey;
	readonly value: T;
	readonly schema: ZodMiniType<T>;
}): void {
	const filepath = getFullPath(cacheKey);

	const { success, error, data } = schema.safeParse(value);
	if (!success) {
		throw new Error(`Could not set file cache value because it did not match the schema. Message: ${error.message}`);
	}

	writeFileSync(filepath, JSON.stringify(data));
}

export function getFromFileCache<T extends JsonValue>({
	cacheKey,
	schema,
}: {
	readonly cacheKey: FileCacheKey;
	readonly schema: ZodMiniType<T>;
}): T | undefined {
	const filepath = getFullPath(cacheKey);
	if (!existsSync(filepath)) {
		return undefined;
	}
	const existingContent = readFileSync(filepath);
	return schema.parse(JSON.parse(existingContent));
}

function getFullPath(cacheKey: FileCacheKey): string {
	const { isTest } = getEnvConfig();
	const suffix = isTest ? "-test" : "";
	return `./${getDataDir(isTest)}/${cacheKey}${suffix}.json`;
}
