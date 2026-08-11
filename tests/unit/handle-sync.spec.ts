import type { Request, Response } from "express";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, it, type Mock, vi } from "vitest";
import { LearnMcpExceptionError } from "../../lib/exceptions/learn-mcp-exception.js";
import { runAndRecordSync } from "../../lib/sync/sync-runner.js";
import { handleSync } from "../../lib/transport/routes/sync.route.js";

vi.mock("../../lib/sync/sync-runner.js", () => ({ runAndRecordSync: vi.fn() }));

type MockResponse = { readonly res: Response; readonly status: Mock; readonly json: Mock };

function createResponse(): MockResponse {
	const status = vi.fn();
	const json = vi.fn();
	const res = { json, status } as unknown as Response;
	status.mockReturnValue(res);
	json.mockReturnValue(res);
	return { json, res, status };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it("returns 202 when the sync hasn't finished after 15 seconds", async () => {
	vi.mocked(runAndRecordSync).mockReturnValue(
		new Promise(() => {
			// Never resolves — simulates a sync that hasn't finished within the test's timeout window.
		}),
	);
	const { res, status } = createResponse();

	const pending = handleSync({} as Request, res);
	await vi.advanceTimersByTimeAsync(15_000);
	await pending;

	expect(status).toHaveBeenCalledWith(202);
});

it("returns 409 syncAlreadyRunning when the lock is already held", async () => {
	vi.mocked(runAndRecordSync).mockRejectedValue(
		new LearnMcpExceptionError(
			"syncAlreadyRunning",
			"A sync is already running. Please wait for it to finish before starting another one.",
		),
	);
	const { res, status } = createResponse();

	await handleSync({} as Request, res);

	expect(status).toHaveBeenCalledWith(409);
});

it("returns 200 when the sync finishes within the timeout", async () => {
	const startedAt = DateTime.now();
	vi.mocked(runAndRecordSync).mockResolvedValue({
		durationMs: 5,
		endedAt: startedAt,
		outcome: {
			data: {
				apiReferenceEndpointsCount: 0,
				apiReferenceObjectsCount: 0,
				dbName: "test.db",
				index: { added: 0, changed: 0, removed: 0, total: 0, unchanged: 0 },
				searchRecordsCount: 0,
			},
			success: true,
		},
		startedAt,
	});
	const { res, status } = createResponse();

	await handleSync({} as Request, res);

	expect(status).toHaveBeenCalledWith(200);
});
