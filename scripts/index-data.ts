import { rm } from "node:fs/promises";
import { getDbPath } from "../lib/config.js";
import { syncDatabase } from "../lib/public_api.js";

const dbPath = getDbPath();
await Promise.all(
	[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(async (file) => {
		await rm(file, { force: true });
	}),
);

await syncDatabase();
