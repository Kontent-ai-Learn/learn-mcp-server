import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

interface EnvConfig {
	readonly port: number;
	readonly dataPath: string;
	readonly learnHost: string;
	readonly isTest: boolean;
}

export function getEnvConfig(): EnvConfig {
	loadEnvironmentVariables();

	const port = getOptionalValue("Port");
	const dataPath = getOptionalValue("DataPath") ?? "data";
	const learnHost = getOptionalValue("LearnHost") ?? "http://localhost:3000";
	const isTest = getOptionalValue("IsTest") === "true";

	return {
		dataPath,
		isTest,
		learnHost,
		port: port ? Number(port) : 3002,
	};
}

function getOptionalValue(name: string): string | undefined {
	return process.env[name];
}

function loadEnvironmentVariables(): void {
	const moduleDir = import.meta.dirname;
	const packageJsonPath = findFile("package.json", moduleDir);
	if (!packageJsonPath) {
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
