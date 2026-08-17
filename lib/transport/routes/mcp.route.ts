import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { Duration } from "luxon";
import { createServer } from "../../server.js";
import { getErrorMessage } from "../../utils/error.utils.js";
import { logger } from "../../utils/logger.js";
import { withTimeout } from "../../utils/timeout.utils.js";
import { logAndRespondError, setRequestTimeoutResponse } from "./route.utils.js";

/** Generous enough to cover a cold-start embedding-model load; guards against a genuinely stuck request. */
const MCP_REQUEST_TIMEOUT = Duration.fromObject({ seconds: 30 });

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
	const { success, error } = await tryCatchAsync(async () => {
		const { server } = createServer();
		const transport = new StreamableHTTPServerTransport({});
		res.on("close", () => {
			logger.log({ message: "Request closed" });
			transport.close().catch((closeError: unknown) => {
				logger.log({ message: `Failed to close transport: ${getErrorMessage(closeError)}`, type: "error" });
			});
			server.close().catch((closeError: unknown) => {
				logger.log({ message: `Failed to close server: ${getErrorMessage(closeError)}`, type: "error" });
			});
		});

		await server.connect(transport);
		const handled = transport.handleRequest(Object.assign(req, {}), res, req.body);
		const raceResult = await withTimeout(handled, MCP_REQUEST_TIMEOUT);

		if (raceResult.kind === "timedOut") {
			handled.catch((laterError: unknown) => {
				logger.log({ message: `MCP request timed out but later failed: ${getErrorMessage(laterError)}`, type: "error" });
			});
			if (!res.headersSent) {
				setRequestTimeoutResponse(res);
			}
		}
	});

	if (!success) {
		logAndRespondError({ error, requestLabel: "MCP", res });
	}
}
