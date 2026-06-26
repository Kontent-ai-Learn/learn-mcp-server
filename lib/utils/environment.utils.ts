import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export function getEnvConfig(): {
	readonly port: number;
	readonly dbPath: string;
	readonly cacheDir: string;
} {
	loadEnvironmentVariables();

	return {
		port: process.env.PORT ? +process.env.PORT : 3002,
		dbPath: process.env.DB_PATH ?? "db/learn.db",
		cacheDir: process.env.CACHE_DIR ?? ".cache/transformers",
	};
}

function loadEnvironmentVariables(): void {
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	const packageJsonPath = findFile("package.json", moduleDir);
	if (packageJsonPath === undefined) {
		return;
	}
	const envFilePath = path.join(path.dirname(packageJsonPath), ".env");
	if (existsSync(envFilePath)) {
		loadEnvFile(envFilePath);
	}
}

function findFile(fileName: string, dir: string): string | undefined {
	const candidate = path.join(dir, fileName);
	if (existsSync(candidate)) {
		return candidate;
	}
	const parent = path.dirname(dir);
	return parent === dir ? undefined : findFile(fileName, parent);
}
