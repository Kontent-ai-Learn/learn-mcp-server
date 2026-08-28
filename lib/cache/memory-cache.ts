import type { ZodMiniType } from "zod/mini";

type Cache = Map<string, unknown>;

const cache: Cache = new Map();

export function setMemoryCache<T>({
	key,
	value,
	schema,
}: {
	readonly key: string;
	readonly value: T;
	readonly schema: ZodMiniType<T>;
}): void {
	const parseResult = schema.safeParse(value);
	if (!parseResult.success) {
		throw new Error(`Failed to set value for memory cache key ${key} due to invalid schema with error: ${parseResult.error}`);
	}
	cache.set(key, value);
}

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
	setMemoryCache({ key, value: resolvedValue, schema });
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
	setMemoryCache({ key, value: resolvedValue, schema });
	return resolvedValue;
}
