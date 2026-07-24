import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

type EnvConfig = {
	readonly port: number;
	readonly dataPath: string;
	readonly cacheDir: string;
	readonly learnHost: string;
	readonly isTest: boolean;
	readonly learnUrls: {
		readonly searchRecordsUrl: string;
		readonly apiReferenceEndpointsUrl: string;
		readonly apiReferenceObjectsUrl: string;
	};
};

export function getEnvConfig(): EnvConfig {
	loadEnvironmentVariables();

	const port = getOptionalValue("Port");
	const dataPath = getOptionalValue("DataPath") ?? "data";
	const cacheDir = getOptionalValue("CacheDir") ?? ".cache/transformers";
	const learnHost = getOptionalValue("LearnHost") ?? "http://localhost:3000";
	const searchRecordsPath = getOptionalValue("SearchRecordsUrl") ?? "/learn/api/ai/getSearchRecords";
	const apiReferenceEndpointsPath = getOptionalValue("ApiReferenceEndpointsUrl") ?? "/learn/api/ai/getApiReferenceEndpoints";
	const apiReferenceObjectsPath = getOptionalValue("ApiReferenceObjectsUrl") ?? "/learn/api/ai/getApiReferenceObjects";
	const isTest = getOptionalValue("IsTest") === "true";

	return {
		port: port ? +port : 3002,
		dataPath,
		cacheDir,
		learnHost,
		isTest,
		learnUrls: {
			apiReferenceEndpointsUrl: composeUrl(learnHost, apiReferenceEndpointsPath),
			apiReferenceObjectsUrl: composeUrl(learnHost, apiReferenceObjectsPath),
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
