import path from "node:path";
import { match } from "ts-pattern";
import { z } from "zod/mini";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { existsSync, loadEnvFile } from "./file.utils.js";

const syncIntervalUnitSchema = z.literal(["minutes", "hours", "days"]);
type SyncIntervalUnit = z.infer<typeof syncIntervalUnitSchema>;

const envConfigSchema = z.readonly(
	z.object({
		apiToken: z.string(),
		autoSyncEnabled: z.boolean(),
		dataPath: z.string(),
		isTest: z.boolean(),
		learnHost: z.string(),
		port: z.number(),
		syncIntervalUnit: syncIntervalUnitSchema,
		syncIntervalValue: z.number(),
	}),
);
type EnvConfig = z.infer<typeof envConfigSchema>;

/**
 * Env vars never change at runtime, so the parsed config is cached after the first call —
 * without this, every caller (health checks, sync scheduling, etc.) re-walks the filesystem for
 * `.env` and reloads it from disk on every call.
 */
export function getEnvConfig(): EnvConfig {
	return getOrSetFromMemoryCache({
		key: "envConfig",
		schema: envConfigSchema,
		value: () => computeEnvConfig(),
	});
}

function computeEnvConfig(): EnvConfig {
	loadEnvironmentVariables();

	const apiToken = getOptionalValue("ApiToken") ?? "";
	const port = getOptionalValue("Port");
	const dataPath = getOptionalValue("DataPath") ?? "data";
	const learnHost = getOptionalValue("LearnHost") ?? "http://localhost:3000";
	const isTest = getOptionalValue("IsTest") === "true";
	const autoSyncEnabled = getOptionalValue("AutoSyncEnabled") !== "false";
	const syncIntervalValueRaw = getOptionalValue("SyncIntervalValue");
	const syncIntervalUnit = parseSyncIntervalUnit(getOptionalValue("SyncIntervalUnit"));

	return {
		apiToken,
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
