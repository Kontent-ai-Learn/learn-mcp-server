import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { setMemoryCache, takeFromMemoryCache } from "../../lib/cache/memory-cache.js";
import { getTestDbPath } from "../../lib/config.js";
import { closeCachedDb } from "../../lib/database/db.js";
import { cleanData } from "../../lib/initialization/initialization.js";
import { acquireSyncLock, releaseSyncLock } from "../../lib/sync/sync-lock.js";

const schema = z.string();

describe("takeFromMemoryCache", () => {
	it("returns the value and removes it", () => {
		const key = `take-${Math.random()}`;
		setMemoryCache({ key, schema, value: "cached" });

		expect(takeFromMemoryCache({ key, schema })).toBe("cached");
		expect(takeFromMemoryCache({ key, schema })).toBeUndefined();
	});

	it("returns undefined for an absent key", () => {
		expect(takeFromMemoryCache({ key: `absent-${Math.random()}`, schema })).toBeUndefined();
	});

	it("rejects a cached value that does not match the schema", () => {
		const key = `mismatch-${Math.random()}`;
		setMemoryCache({ key, schema, value: "a string" });

		expect(() => takeFromMemoryCache({ key, schema: z.number() })).toThrow();
	});
});

describe("closeCachedDb", () => {
	it("is a no-op when nothing is cached, and safe to call twice", async () => {
		await expect(closeCachedDb()).resolves.toBeUndefined();
		await expect(closeCachedDb()).resolves.toBeUndefined();
	});
});

describe("cleanData", () => {
	afterEach(() => {
		releaseSyncLock();
	});

	/**
	 * The assertion that matters is the second one: it must abort *before* unlinking, so a sync
	 * that is mid-index keeps the files it is writing to.
	 */
	it("refuses to run while a sync holds the lock, without deleting anything", async () => {
		const dbPath = getTestDbPath();
		const existedBefore = existsSync(dbPath);
		acquireSyncLock();

		await expect(cleanData({ isTest: true })).rejects.toThrow(/already running/i);
		expect(existsSync(dbPath)).toBe(existedBefore);
	});

	it("releases the lock again so a later sync can run", async () => {
		acquireSyncLock();
		await expect(cleanData({ isTest: true })).rejects.toThrow();
		releaseSyncLock();

		// Acquiring now must not throw — the failed clean left the lock as it found it.
		expect(() => {
			acquireSyncLock();
		}).not.toThrow();
	});
});
