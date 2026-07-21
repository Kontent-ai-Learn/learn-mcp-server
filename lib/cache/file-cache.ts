import type { ZodMiniType } from "zod/mini";

export function getOrSetFromFileCache<T>({
	key,
	value,
	schema,
}: {
	readonly key: string;
	readonly value: () => Promise<T>;
	readonly schema: ZodMiniType<T>;
}): Promise<T> {
	throw new Error("Not implemented");
}
