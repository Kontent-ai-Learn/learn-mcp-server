import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as z from "zod/mini";
import { aiApiReferenceRecordSchema, searchRecordSchema } from "../lib/data/learn-api.js";
import { openDb } from "../lib/database/db.js";
import { indexSourceDocuments } from "../lib/indexing/indexer.js";

// Must match env.DB_PATH in vitest.config.ts and vitest-integration.config.ts.
const TEST_DB_PATH: string = "db/learn-test.db";
const samplesPath = fileURLToPath(new URL("../samples/test-db-source-docs.json", import.meta.url));

const sourceSchema = z.readonly(
	z.object({
		searchRecords: z.array(searchRecordSchema),
		apiReferenceRecords: z.array(aiApiReferenceRecordSchema),
	}),
);

const raw: unknown = JSON.parse(await readFile(samplesPath, "utf8"));
const { searchRecords: documents } = z.parse(sourceSchema, raw);

await Promise.all(
	[TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].map(async (file) => {
		await rm(file, { force: true });
	}),
);

const db = await openDb(TEST_DB_PATH);
await indexSourceDocuments(db, documents);
