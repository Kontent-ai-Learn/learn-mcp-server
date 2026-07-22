import type { ZodMiniType } from "zod/mini";

type Cache = Map<string, unknown>;

const cache: Cache = new Map();

export async function getOrSetFromMemoryCache<T>({
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

export function getFromCache<T>({ key, schema }: { readonly key: string; readonly schema: ZodMiniType<T> }): T | undefined {
	const dataFromCache = cache.get(key);
	return dataFromCache ? schema.parse(dataFromCache) : undefined;
}
