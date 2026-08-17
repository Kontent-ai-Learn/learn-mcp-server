import type { ZodMiniType } from "zod/mini";

type Cache = Map<string, unknown>;

const cache: Cache = new Map();

export function getOrSetFromMemoryCache<T>({
	key,
	value,
	schema,
}: {
	readonly key: string;
	readonly value: () => T;
	readonly schema: ZodMiniType<T>;
}): T {
	const itemFromCache = cache.get(key);
	if (itemFromCache) {
		return schema.parse(itemFromCache);
	}

	const resolvedValue = value();
	cache.set(key, resolvedValue);
	return resolvedValue;
}

export async function getOrSetFromMemoryCacheAsync<T>({
	key,
	value,
	schema,
}: {
	readonly key: string;
	readonly value: () => Promise<T>;
	readonly schema: ZodMiniType<T>;
}): Promise<T> {
	const itemFromCache = cache.get(key);
	if (itemFromCache) {
		return schema.parse(itemFromCache);
	}

	const resolvedValue = await value();
	cache.set(key, resolvedValue);
	return resolvedValue;
}
