import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { match } from "ts-pattern";

type SyncIntervalUnit = "minutes" | "hours" | "days";

interface EnvConfig {
	readonly port: number;
	readonly dataPath: string;
	readonly learnHost: string;
	readonly isTest: boolean;
	readonly autoSyncEnabled: boolean;
	readonly syncIntervalValue: number;
	readonly syncIntervalUnit: SyncIntervalUnit;
}

export function getEnvConfig(): EnvConfig {
	loadEnvironmentVariables();

	const port = getOptionalValue("Port");
	const dataPath = getOptionalValue("DataPath") ?? "data";
	const learnHost = getOptionalValue("LearnHost") ?? "http://localhost:3000";
	const isTest = getOptionalValue("IsTest") === "true";
	const autoSyncEnabled = getOptionalValue("AutoSyncEnabled") !== "false";
	const syncIntervalValueRaw = getOptionalValue("SyncIntervalValue");
	const syncIntervalUnit = parseSyncIntervalUnit(getOptionalValue("SyncIntervalUnit"));

	return {
		autoSyncEnabled,
		dataPath,
		isTest,
		learnHost,
		port: port ? Number(port) : 3002,
		syncIntervalUnit,
		syncIntervalValue: syncIntervalValueRaw ? Number(syncIntervalValueRaw) : 1,
	};
}

function getOptionalValue(name: string): string | undefined {
	return process.env[name];
}

function parseSyncIntervalUnit(raw: string | undefined): SyncIntervalUnit {
	return match(raw)
		.with("minutes", () => "minutes" as const)
		.with("hours", () => "hours" as const)
		.with("days", () => "days" as const)
		.otherwise(() => "days" as const);
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
