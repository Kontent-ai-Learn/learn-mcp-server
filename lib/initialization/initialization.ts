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
import { readFile, rm } from "../utils/file.utils.js";
import { logger } from "../utils/logger.js";

export interface SyncResult {
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
}

const testSearchRecordsPath = fileURLToPath(new URL("../../samples/test-db-source-docs.json", import.meta.url));

const sourceSchema = z.readonly(
	z.object({
		apiReferenceEndpoints: z.array(apiReferenceEndpointSchema),
		apiReferenceObjects: z.array(apiReferenceObjectSchema),
		searchRecords: z.array(searchRecordSchema),
	}),
);

export async function syncAll(options?: { readonly isTest?: boolean }): Promise<SyncResult> {
	logger.log({ message: `Initializing ${colorize("yellow", options?.isTest ? "test" : "prod")} data...` });

	return options?.isTest === true ? await initializeTestData() : await initializeProdData();
}

export async function cleanData(options?: Parameters<typeof syncAll>[0]): Promise<void> {
	const dbPath = getDbPath(options);

	await Promise.all(
		[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(async (file) => {
			await rm(file);
		}),
	);
}

async function initializeProdData(): Promise<SyncResult> {
	const apiReferenceEndpoints = await initializeApiReferenceEndpoints();
	const apiReferenceObjects = await initializeApiReferenceObjects();
	const searchRecords = await initializeSearchRecords();

	return await finishSync({ apiReferenceEndpoints, apiReferenceObjects, isTest: false, searchRecords });
}

async function initializeTestData(): Promise<SyncResult> {
	const { searchRecords, apiReferenceEndpoints, apiReferenceObjects } = await getTestData();

	setToFileCache({
		cacheKey: "api-reference-endpoints",
		schema: z.readonly(z.array(apiReferenceEndpointSchema)),
		value: apiReferenceEndpoints,
	});
	setToFileCache({
		cacheKey: "api-reference-objects",
		schema: z.readonly(z.array(apiReferenceObjectSchema)),
		value: apiReferenceObjects,
	});
	setToFileCache({ cacheKey: "search-records", schema: z.readonly(z.array(searchRecordSchema)), value: searchRecords });

	return await finishSync({ apiReferenceEndpoints, apiReferenceObjects, isTest: true, searchRecords });
}

async function finishSync({
	isTest,
	searchRecords,
	apiReferenceEndpoints,
	apiReferenceObjects,
}: {
	readonly isTest: boolean;
	readonly searchRecords: readonly SearchRecord[];
	readonly apiReferenceEndpoints: readonly unknown[];
	readonly apiReferenceObjects: readonly ApiReferenceObject[];
}): Promise<SyncResult> {
	const documents = [...searchRecords, ...apiReferenceObjects.map((object) => toSearchRecord(object))];
	const index = await indexWithDb({ documents, isTest });

	return toSyncResult({ apiReferenceEndpoints, apiReferenceObjects, index, isTest, searchRecords });
}

/**
 * Opens the DB just for this indexing pass and closes it afterwards — `syncAll` can be
 * called many times over a long-lived server process (e.g. the daily auto-sync loop), and
 * leaving connections open would leak handles and eventually fail with a file-locking error.
 */
async function indexWithDb({
	documents,
	isTest,
}: {
	readonly documents: readonly SearchRecord[];
	readonly isTest: boolean;
}): Promise<IndexDocumentsResult> {
	const db = await getDb({ isTest });
	try {
		return await indexSearchRecords(db, documents);
	} finally {
		await db.close();
	}
}

/**
 * Objects are not part of the search endpoint, so they are indexed as their own
 * search records; the endpoint's markdownContent already includes the title.
 */
function toSearchRecord(object: ApiReferenceObject): SearchRecord {
	return {
		codename: object.codename,
		id: object.id,
		markdownContent: object.markdownContent,
		title: object.title,
		type: "object",
		url: object.url,
	};
}

function toSyncResult({
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
}): SyncResult {
	return {
		apiReferenceEndpointsCount: apiReferenceEndpoints.length,
		apiReferenceObjectsCount: apiReferenceObjects.length,
		dbName: getDbPath({ isTest }),
		index: {
			added: index.addedCount,
			changed: index.changedCount,
			removed: index.removedCount,
			total: searchRecords.length + apiReferenceObjects.length,
			unchanged: index.unchangedCount,
		},
		searchRecordsCount: searchRecords.length,
	};
}

function getDbPath(options?: Parameters<typeof syncAll>[0]): string {
	return options?.isTest ? getTestDbPath() : getProdDbPath();
}

async function getDb(options?: Parameters<typeof syncAll>[0]): Promise<Database> {
	return await openDb(getDbPath(options));
}

async function getTestData(): Promise<z.infer<typeof sourceSchema>> {
	const raw: unknown = JSON.parse(await readFile(testSearchRecordsPath));
	return z.parse(sourceSchema, raw);
}
