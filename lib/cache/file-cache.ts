import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { JsonValue } from "@kontent-ai/core-sdk";
import type { ZodMiniType } from "zod/mini";
import { getDataDir } from "../config.js";
import { getEnvConfig } from "../utils/environment.utils.js";

export type FileCacheKey = `api-reference-records` | `api-reference-objects` | `search-records`;

export async function getOrSetFromFileCache<T extends JsonValue>({
	cacheKey,
	value,
	schema,
}: {
	readonly cacheKey: FileCacheKey;
	readonly value: () => Promise<T>;
	readonly schema: ZodMiniType<T>;
}): Promise<T> {
	const filepath = getFullPath(cacheKey);
	const resolveAndStoreValue = async () => {
		const resolvedValue = await value();

		writeCacheFile(filepath, JSON.stringify(resolvedValue));
		return resolvedValue;
	};

	if (!existsSync(filepath)) {
		return await resolveAndStoreValue();
	}
	const existingContent = readFileSync(filepath, "utf8");
	return schema.parse(JSON.parse(existingContent));
}

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

	writeCacheFile(filepath, JSON.stringify(data));
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
	const existingContent = readFileSync(filepath, "utf8");
	return schema.parse(JSON.parse(existingContent));
}

export function getFullPath(cacheKey: FileCacheKey): string {
	const { isTest } = getEnvConfig();
	const suffix = isTest ? "-test" : "";
	return `./${getDataDir(isTest)}/${cacheKey}${suffix}.json`;
}

function writeCacheFile(filepath: string, content: string): void {
	mkdirSync(dirname(filepath), { recursive: true });
	writeFileSync(filepath, content);
}
