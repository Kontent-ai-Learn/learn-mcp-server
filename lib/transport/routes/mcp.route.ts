import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createServer } from "../../server.js";
import { getErrorMessage } from "../../utils/error.utils.js";
import { logger } from "../../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../../utils/version.js";
import { setInternalServerErrorResponse } from "./route.utils.js";

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
	const { success, error } = await tryCatchAsync(async () => {
		const { server } = createServer();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		res.on("close", () => {
			console.log("Request closed");
			transport.close();
			server.close();
		});

		await server.connect(transport);
		await transport.handleRequest(Object.assign(req, {}), res, req.body);
	});

	if (!success) {
		const errorMessage = getErrorMessage(error);
		logger.log({
			type: "error",
			message: `${packageJsonName}@${packageJsonVersion} - Error handling MCP request: ${errorMessage}`,
		});
		if (!res.headersSent) {
			setInternalServerErrorResponse(res, errorMessage);
		}
	}
}
