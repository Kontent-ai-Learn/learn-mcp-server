import { rm } from "node:fs/promises";
import { syncDatabase } from "../lib/public_api.js";
import { getEnvConfig } from "../lib/utils/environment.utils.js";

const dbPath = getEnvConfig().dbPath;
await Promise.all(
	[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map(async (file) => {
		await rm(file, { force: true });
	}),
);

await syncDatabase();
