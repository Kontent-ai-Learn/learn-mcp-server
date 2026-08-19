import type { Request, Response } from "express";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, it, type Mock, vi } from "vitest";
import { LearnMcpExceptionError } from "../../lib/exceptions/learn-mcp-exception.js";
import { runAndRecordSync } from "../../lib/sync/sync-runner.js";
import { handleSync } from "../../lib/transport/routes/sync.route.js";
import { getEnvConfig } from "../../lib/utils/environment.utils.js";

const VALID_TOKEN = "test-token";

vi.mock("../../lib/sync/sync-runner.js", () => ({ runAndRecordSync: vi.fn() }));
vi.mock("../../lib/utils/environment.utils.js", () => ({ getEnvConfig: vi.fn() }));

type MockResponse = { readonly res: Response; readonly status: Mock; readonly json: Mock };

function createResponse(): MockResponse {
	const status = vi.fn();
	const json = vi.fn();
	const res = { json, status } as unknown as Response;
	status.mockReturnValue(res);
	json.mockReturnValue(res);
	return { json, res, status };
}

function createRequest(token?: string): Request {
	return { query: token === undefined ? {} : { token } } as unknown as Request;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	vi.mocked(getEnvConfig).mockReturnValue({ apiToken: VALID_TOKEN } as ReturnType<typeof getEnvConfig>);
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

	const pending = handleSync(createRequest(VALID_TOKEN), res);
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

	await handleSync(createRequest(VALID_TOKEN), res);

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

	await handleSync(createRequest(VALID_TOKEN), res);

	expect(status).toHaveBeenCalledWith(200);
});

it("returns 401 when the token query parameter is missing", async () => {
	const { res, status } = createResponse();

	await handleSync(createRequest(), res);

	expect(status).toHaveBeenCalledWith(401);
	expect(runAndRecordSync).not.toHaveBeenCalled();
});

it("returns 401 when the token query parameter doesn't match", async () => {
	const { res, status } = createResponse();

	await handleSync(createRequest("wrong-token"), res);

	expect(status).toHaveBeenCalledWith(401);
	expect(runAndRecordSync).not.toHaveBeenCalled();
});
