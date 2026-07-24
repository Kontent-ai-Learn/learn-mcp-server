import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { setToFileCache } from "../cache/file-cache.js";
import { getProdDbPath, getTestDbPath } from "../config.js";
import { initializeApiReferenceEndpoints } from "../content/api-reference-endpoints.js";
import { initializeApiReferenceObjects } from "../content/api-reference-objects.js";
import { apiReferenceEndpointSchema } from "../content/models/api-reference-endpoints.models.js";
import { type ApiReferenceObject, apiReferenceObjectSchema } from "../content/models/api-reference-objects.models.js";
import { type SearchRecord, searchRecordSchema } from "../content/models/search-records.models.js";
import { initializeSearchRecords } from "../content/search-records.js";
import { openDb } from "../database/db.js";
import { type IndexDocumentsResult, indexSearchRecords } from "../indexing/indexer.js";
import { logger } from "../utils/logger.js";

export type InitializeResult = {
	readonly dbName: string;
	readonly searchRecordsCount: number;
	readonly apiReferenceEndpointsCount: number;
	readonly apiReferenceObjectsCount: number;
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
		apiReferenceEndpoints: z.array(apiReferenceEndpointSchema),
		apiReferenceObjects: z.array(apiReferenceObjectSchema),
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
	const apiReferenceEndpoints = await initializeApiReferenceEndpoints();
	const apiReferenceObjects = await initializeApiReferenceObjects();
	const searchRecords = await initializeSearchRecords();

	const documents = [...searchRecords, ...apiReferenceObjects.map(toSearchRecord)];
	const index = await indexSearchRecords(await getDb({ isTest: false }), documents);

	return toInitializeResult({ isTest: false, searchRecords, apiReferenceEndpoints, apiReferenceObjects, index });
}

async function initializeTestData(): Promise<InitializeResult> {
	const { searchRecords, apiReferenceEndpoints, apiReferenceObjects } = await getTestData();

	setToFileCache({
		cacheKey: "api-reference-endpoints",
		value: apiReferenceEndpoints,
		schema: z.readonly(z.array(apiReferenceEndpointSchema)),
	});

	setToFileCache({
		cacheKey: "api-reference-objects",
		value: apiReferenceObjects,
		schema: z.readonly(z.array(apiReferenceObjectSchema)),
	});

	setToFileCache({
		cacheKey: "search-records",
		value: searchRecords,
		schema: z.readonly(z.array(searchRecordSchema)),
	});

	const documents = [...searchRecords, ...apiReferenceObjects.map(toSearchRecord)];
	const index = await indexSearchRecords(await getDb({ isTest: true }), documents);

	return toInitializeResult({ isTest: true, searchRecords, apiReferenceEndpoints, apiReferenceObjects, index });
}

/**
 * Objects are not part of the search endpoint, so they are indexed as their own
 * search records; the endpoint's markdownContent already includes the title.
 */
function toSearchRecord(object: ApiReferenceObject): SearchRecord {
	return {
		id: object.id,
		codename: object.codename,
		title: object.title,
		url: object.url,
		type: "object",
		markdownContent: object.markdownContent,
	};
}

function toInitializeResult({
	isTest,
	searchRecords,
	apiReferenceEndpoints,
	apiReferenceObjects,
	index,
}: {
	readonly isTest: boolean;
	readonly searchRecords: readonly unknown[];
	readonly apiReferenceEndpoints: readonly unknown[];
	readonly apiReferenceObjects: readonly unknown[];
	readonly index: IndexDocumentsResult;
}): InitializeResult {
	return {
		dbName: getDbPath({ isTest }),
		searchRecordsCount: searchRecords.length,
		apiReferenceEndpointsCount: apiReferenceEndpoints.length,
		apiReferenceObjectsCount: apiReferenceObjects.length,
		index: {
			added: index.addedCount,
			changed: index.changedCount,
			removed: index.removedCount,
			unchanged: index.unchangedCount,
			total: searchRecords.length + apiReferenceObjects.length,
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
