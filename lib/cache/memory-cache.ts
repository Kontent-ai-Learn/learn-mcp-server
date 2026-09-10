import type { ZodType } from "zod";

type Cache = Map<string, unknown>;

const cache: Cache = new Map();

export function setMemoryCache<T>({ key, value, schema }: { readonly key: string; readonly value: T; readonly schema: ZodType<T> }): void {
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
	readonly schema: ZodType<T>;
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
	readonly schema: ZodType<T>;
}): Promise<T> {
	const itemFromCache = cache.get(key);
	if (itemFromCache) {
		return schema.parse(itemFromCache);
	}

	const resolvedValue = await value();
	setMemoryCache({ key, value: resolvedValue, schema });
	return resolvedValue;
}

/**
 * Remove an entry and return its validated value, or `undefined` when absent.
 *
 * A single remove-and-return rather than a get followed by a delete: callers that dispose of the
 * value (closing a database handle, say) `await` in between, and nothing must be able to hand the
 * same value to another caller in that gap.
 */
export function takeFromMemoryCache<T>({ key, schema }: { readonly key: string; readonly schema: ZodType<T> }): T | undefined {
	const itemFromCache = cache.get(key);
	cache.delete(key);

	return itemFromCache === undefined ? undefined : schema.parse(itemFromCache);
}
