import { describe, expect, it } from "vitest";
import { LearnMcpExceptionError } from "../../lib/exceptions/learn-mcp-exception.js";
import { acquireSyncLock, releaseSyncLock } from "../../lib/sync/sync-lock.js";

describe("sync-lock", () => {
	it("throws LearnMcpException when acquiring a lock that is already held", () => {
		acquireSyncLock();
		try {
			expect(() => {
				acquireSyncLock();
			}).toThrow(LearnMcpExceptionError);
		} finally {
			releaseSyncLock();
		}
	});

	it("sets type to 'syncAlreadyRunning' on the thrown exception", () => {
		acquireSyncLock();
		try {
			expect.assertions(1);
			try {
				acquireSyncLock();
			} catch (error) {
				expect((error as LearnMcpExceptionError).type).toBe("syncAlreadyRunning");
			}
		} finally {
			releaseSyncLock();
		}
	});

	it("allows acquiring again after release", () => {
		acquireSyncLock();
		releaseSyncLock();
		expect(() => {
			acquireSyncLock();
		}).not.toThrow();
		releaseSyncLock();
	});
});
