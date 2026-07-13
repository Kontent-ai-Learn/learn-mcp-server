import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as z from "zod/mini";
import { mapSegmentToSourceDoc, segmentSchema } from "../lib/data/search-records.js";
import { openDb } from "../lib/indexing/db.js";
import { indexSourceDocuments } from "../lib/indexing/indexer.js";

// Must match env.DB_PATH in vitest.config.ts and vitest-integration.config.ts.
const TEST_DB_PATH: string = "db/learn-test.db";
const samplesPath = fileURLToPath(new URL("../samples/test-db-source-docs.json", import.meta.url));

const raw: unknown = JSON.parse(await readFile(samplesPath, "utf8"));
const documents = z.parse(z.array(segmentSchema), raw).map(mapSegmentToSourceDoc);

await Promise.all(
	[TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`].map(async (file) => {
		await rm(file, { force: true });
	}),
);

const db = await openDb(TEST_DB_PATH);
await indexSourceDocuments(db, documents);
