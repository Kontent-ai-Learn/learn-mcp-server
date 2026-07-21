import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

type EnvConfig = {
	readonly port: number;
	readonly dbPath: string;
	readonly cacheDir: string;
	readonly learnHost: string;
	readonly learnUrls: {
		readonly searchRecordsUrl: string;
		readonly apiReferenceRecordsUrl: string;
	};
};

export function getEnvConfig(): EnvConfig {
	loadEnvironmentVariables();

	const port = getOptionalValue("PORT");
	const dbPath = getOptionalValue("DB_PATH") ?? "db/learn.db";
	const cacheDir = getOptionalValue("CACHE_DIR") ?? ".cache/transformers";
	const learnHost = getOptionalValue("LearnHost") ?? "http://localhost:3000";
	const searchRecordsPath = getOptionalValue("SearchRecordsUrl") ?? "/learn/api/ai/getSearchRecords";
	const apiReferenceRecordsPath = getOptionalValue("ApiReferenceRecordsUrl") ?? "/learn/api/ai/getApiReferenceRecords";

	return {
		port: port ? +port : 3002,
		dbPath,
		cacheDir,
		learnHost,
		learnUrls: {
			apiReferenceRecordsUrl: composeUrl(learnHost, apiReferenceRecordsPath),
			searchRecordsUrl: composeUrl(learnHost, searchRecordsPath),
		},
	};
}

function composeUrl(host: string, path: string): string {
	return new URL(path, host).toString();
}

function getOptionalValue(name: string): string | undefined {
	return process.env[name];
}

function loadEnvironmentVariables(): void {
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	const packageJsonPath = findFile("package.json", moduleDir);
	if (packageJsonPath === undefined) {
		return;
	}
	const envFilePath = path.join(path.dirname(packageJsonPath), ".env");
	if (!existsSync(envFilePath)) {
		return;
	}

	loadEnvFile(envFilePath);
}

function findFile(fileName: string, dir: string): string | undefined {
	const candidate = path.join(dir, fileName);
	if (existsSync(candidate)) {
		return candidate;
	}
	const parent = path.dirname(dir);
	return parent === dir ? undefined : findFile(fileName, parent);
}
