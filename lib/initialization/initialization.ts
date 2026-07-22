import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { getProdDbPath, getTestDbPath } from "../config.js";
import { apiReferenceRecordSchema, initializeApiReferenceRecords } from "../content/api-reference-records.js";
import { initializeSearchRecords, searchRecordSchema } from "../content/search-records.js";
import { openDb } from "../database/db.js";
import { indexSearchRecords } from "../indexing/indexer.js";
import { logger } from "../utils/logger.js";

const testSearchRecordsPath = fileURLToPath(new URL("../../samples/test-db-source-docs.json", import.meta.url));

const sourceSchema = z.readonly(
	z.object({
		searchRecords: z.array(searchRecordSchema),
		apiReferenceRecords: z.array(apiReferenceRecordSchema),
	}),
);

export async function initializeAll(options?: { readonly isTest?: boolean }): Promise<void> {
	logger.log({ message: `Initializing ${colorize("yellow", options?.isTest ? "test" : "prod")} data...` });

	if (options?.isTest) {
		await initializeTestData();
	} else {
		await initializeProdData();
	}
}

export async function cleanData(options?: Parameters<typeof initializeAll>[0]): Promise<void> {
	const dbPath = getDbPath(options);

	await Promise.all(
		[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(async (file) => {
			await rm(file, { force: true });
		}),
	);
}

async function initializeProdData(): Promise<void> {
	await initializeApiReferenceRecords();
	const searchRecords = await initializeSearchRecords();

	await indexSearchRecords(await getDb({ isTest: false }), searchRecords);
}

async function initializeTestData(): Promise<void> {
	const { searchRecords } = await getTestData();
	await indexSearchRecords(await getDb({ isTest: true }), searchRecords);
}

function getDbPath(options?: Parameters<typeof initializeAll>[0]): string {
	return options?.isTest ? getTestDbPath() : getProdDbPath();
}

async function getDb(options?: Parameters<typeof initializeAll>[0]): Promise<Database> {
	return await openDb(getDbPath(options));
}

async function getTestData(): Promise<z.infer<typeof sourceSchema>> {
	const raw: unknown = JSON.parse(await readFile(testSearchRecordsPath, "utf8"));
	return z.parse(sourceSchema, raw);
}
