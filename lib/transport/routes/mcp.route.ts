import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createServer } from "../../server.js";
import { getErrorMessage } from "../../utils/error.utils.js";
import { logger } from "../../utils/logger.js";
import { logAndRespondError } from "./route.utils.js";

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
	const { success, error } = await tryCatchAsync(async () => {
		const { server } = createServer();
		const transport = new StreamableHTTPServerTransport({});
		res.on("close", () => {
			console.log("Request closed");
			transport.close().catch((closeError: unknown) => {
				logger.log({ message: `Failed to close transport: ${getErrorMessage(closeError)}`, type: "error" });
			});
			server.close().catch((closeError: unknown) => {
				logger.log({ message: `Failed to close server: ${getErrorMessage(closeError)}`, type: "error" });
			});
		});

		await server.connect(transport);
		await transport.handleRequest(Object.assign(req, {}), res, req.body);
	});

	if (!success) {
		logAndRespondError({ error, requestLabel: "MCP", res });
	}
}
