import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../../lib/database/db.js";

const createdDirs: string[] = [];

const tempDbPath = async (): Promise<string> => {
	const dir = await mkdtemp(join(tmpdir(), "learn-mcp-open-db-"));
	createdDirs.push(dir);
	return join(dir, "test.db");
};

const removeDbFiles = async (path: string): Promise<void> => {
	for (const file of [path, `${path}-wal`, `${path}-shm`]) {
		await rm(file, { force: true });
	}
};

afterEach(async () => {
	for (const dir of createdDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

describe("openDb", () => {
	it("creates the database and its directory when neither exists", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "learn-mcp-open-db-")), "nested", "deeper", "test.db");
		const db = await openDb(path);

		await expect(db.all("SELECT COUNT(*) AS c FROM documents")).resolves.toEqual([{ c: 0 }]);
		await db.close();
	});

	/** The post-`clean` state: the directory survives, only the files are gone. */
	it("reopens after the database files are deleted", async () => {
		const path = await tempDbPath();
		const first = await openDb(path);
		await first.close();
		await removeDbFiles(path);

		const second = await openDb(path);
		await expect(second.all("SELECT COUNT(*) AS c FROM documents")).resolves.toEqual([{ c: 0 }]);
		await second.close();
	});

	/**
	 * libSQL surfaces a missing parent directory as an opaque
	 * `I/O error (statfs shared WAL coordination path): entity not found`, which is what a broken
	 * deployment looked like in production. `openDb` recreates the directory, so this must succeed —
	 * and if a future libSQL changes that, the failure should still name the directory.
	 */
	it("recreates a directory that was removed entirely", async () => {
		const path = await tempDbPath();
		const first = await openDb(path);
		await first.close();
		await rm(join(path, ".."), { recursive: true, force: true });

		const second = await openDb(path);
		await expect(second.all("SELECT COUNT(*) AS c FROM documents")).resolves.toEqual([{ c: 0 }]);
		await second.close();
	});
});
