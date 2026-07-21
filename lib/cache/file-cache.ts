import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ZodMiniType } from "zod/mini";

export async function getOrSetFromFileCache<T>({
	filePath,
	value,
	schema,
}: {
	readonly filePath: string;
	readonly value: () => Promise<T>;
	readonly schema: ZodMiniType<T>;
}): Promise<T> {
	const resolveAndStoreValue = async () => {
		const resolvedValue = await value();

		writeFileSync(filePath, JSON.stringify(resolvedValue));
		return resolvedValue;
	};

	if (!existsSync(filePath)) {
		return await resolveAndStoreValue();
	}
	const existingContent = readFileSync(filePath, "utf8");
	return schema.parse(JSON.parse(existingContent));
}
