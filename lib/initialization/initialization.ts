import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { setToFileCache } from "../cache/file-cache.js";
import { getProdDbPath, getTestDbPath } from "../config.js";
import { apiReferenceRecordSchema, initializeApiReferenceRecords } from "../content/api-reference-records.js";
import { initializeSearchRecords, searchRecordSchema } from "../content/search-records.js";
import { openDb } from "../database/db.js";
import { type IndexDocumentsResult, indexSearchRecords } from "../indexing/indexer.js";
import { logger } from "../utils/logger.js";

export type InitializeResult = {
	readonly dbName: string;
	readonly searchRecordsCount: number;
	readonly apiReferenceRecordsCount: number;
	readonly index: {
		readonly added: number;
		readonly changed: number;
		readonly removed: number;
		readonly unchanged: number;
		readonly total: number;
	};
};

const testSearchRecordsPath = fileURLToPath(new URL("../../samples/test-db-source-docs.json", import.meta.url));

const sourceSchema = z.readonly(
	z.object({
		searchRecords: z.array(searchRecordSchema),
		apiReferenceRecords: z.array(apiReferenceRecordSchema),
	}),
);

export async function initializeAll(options?: { readonly isTest?: boolean }): Promise<InitializeResult> {
	logger.log({ message: `Initializing ${colorize("yellow", options?.isTest ? "test" : "prod")} data...` });

	return options?.isTest ? await initializeTestData() : await initializeProdData();
}

export async function cleanData(options?: Parameters<typeof initializeAll>[0]): Promise<void> {
	const dbPath = getDbPath(options);

	await Promise.all(
		[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(async (file) => {
			await rm(file, { force: true });
		}),
	);
}

async function initializeProdData(): Promise<InitializeResult> {
	const apiReferenceRecords = await initializeApiReferenceRecords();
	const searchRecords = await initializeSearchRecords();

	const index = await indexSearchRecords(await getDb({ isTest: false }), searchRecords);

	return toInitializeResult({ isTest: false, searchRecords, apiReferenceRecords, index });
}

async function initializeTestData(): Promise<InitializeResult> {
	const { searchRecords, apiReferenceRecords } = await getTestData();

	setToFileCache({
		cacheKey: "api-reference-records",
		value: apiReferenceRecords,
		schema: z.readonly(z.array(apiReferenceRecordSchema)),
	});

	setToFileCache({
		cacheKey: "search-records",
		value: searchRecords,
		schema: z.readonly(z.array(searchRecordSchema)),
	});

	const index = await indexSearchRecords(await getDb({ isTest: true }), searchRecords);

	return toInitializeResult({ isTest: true, searchRecords, apiReferenceRecords, index });
}

function toInitializeResult({
	isTest,
	searchRecords,
	apiReferenceRecords,
	index,
}: {
	readonly isTest: boolean;
	readonly searchRecords: readonly unknown[];
	readonly apiReferenceRecords: readonly unknown[];
	readonly index: IndexDocumentsResult;
}): InitializeResult {
	return {
		dbName: getDbPath({ isTest }),
		searchRecordsCount: searchRecords.length,
		apiReferenceRecordsCount: apiReferenceRecords.length,
		index: {
			added: index.addedCount,
			changed: index.changedCount,
			removed: index.removedCount,
			unchanged: index.unchangedCount,
			total: searchRecords.length,
		},
	};
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
