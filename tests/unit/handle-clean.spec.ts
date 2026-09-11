import type { Request, Response } from "express";
import { afterEach, beforeEach, expect, it, type Mock, vi } from "vitest";
import { LearnMcpExceptionError } from "../../lib/exceptions/learn-mcp-exception.js";
import { cleanData } from "../../lib/initialization/initialization.js";
import { handleClean } from "../../lib/transport/routes/clean.route.js";
import { getEnvConfig } from "../../lib/utils/environment.utils.js";

const VALID_TOKEN = "test-token";

vi.mock("../../lib/initialization/initialization.js", () => ({ cleanData: vi.fn() }));
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
	vi.mocked(getEnvConfig).mockReturnValue({ apiToken: VALID_TOKEN, isTest: true } as ReturnType<typeof getEnvConfig>);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it("returns 202 when the cleanup hasn't finished after 30 seconds", async () => {
	vi.mocked(cleanData).mockReturnValue(
		new Promise(() => {
			// Never resolves — simulates a cleanup that hasn't finished within the route's wait window.
		}),
	);
	const { res, status } = createResponse();

	const pending = handleClean(createRequest(VALID_TOKEN), res);
	await vi.advanceTimersByTimeAsync(30_000);
	await pending;

	expect(status).toHaveBeenCalledWith(202);
});

it("returns 409 syncAlreadyRunning when the lock is already held", async () => {
	vi.mocked(cleanData).mockRejectedValue(
		new LearnMcpExceptionError(
			"syncAlreadyRunning",
			"A sync is already running. Please wait for it to finish before starting another one.",
		),
	);
	const { res, status } = createResponse();

	await handleClean(createRequest(VALID_TOKEN), res);

	expect(status).toHaveBeenCalledWith(409);
});

it("returns 200 when the cleanup finishes within the timeout", async () => {
	vi.mocked(cleanData).mockResolvedValue(undefined);
	const { res, status } = createResponse();

	await handleClean(createRequest(VALID_TOKEN), res);

	expect(status).toHaveBeenCalledWith(200);
});

it("returns 401 when the token query parameter is missing", async () => {
	const { res, status } = createResponse();

	await handleClean(createRequest(), res);

	expect(status).toHaveBeenCalledWith(401);
	expect(cleanData).not.toHaveBeenCalled();
});

it("returns 401 when the token query parameter doesn't match", async () => {
	const { res, status } = createResponse();

	await handleClean(createRequest("wrong-token"), res);

	expect(status).toHaveBeenCalledWith(401);
	expect(cleanData).not.toHaveBeenCalled();
});
