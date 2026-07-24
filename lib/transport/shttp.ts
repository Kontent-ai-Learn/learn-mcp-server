import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Response } from "express";
import { initializeAll } from "../initialization/initialization.js";
import { createServer } from "../server.js";
import { getEnvConfig } from "../utils/environment.utils.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export function startStreamableHTTP(): void {
	const app = express();
	app.use(express.json());

	app.post("/mcp", async (req, res): Promise<void> => {
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
	});

	app.get("/mcp", (_, res) => {
		setMethodNotAllowedResponse(res);
	});

	app.delete("/mcp", (_, res) => {
		setMethodNotAllowedResponse(res);
	});

	app.get("/health", (_, res) => {
		setOkResponse(res, {
			status: "ok",
			timestamp: new Date().toISOString(),
			currentVersion: packageJsonVersion,
		});
	});

	app.post("/init", async (_, res) => {
		const { success, error } = await tryCatchAsync(async () => {
			const { dbName, searchRecordsCount, apiReferenceEndpointsCount, apiReferenceObjectsCount, index } = await initializeAll();

			setOkResponse(res, {
				message: `Successfully indexed '${index.total}' documents into '${dbName}'.`,
				result: {
					dbName,
					searchRecordsCount,
					apiReferenceEndpointsCount,
					apiReferenceObjectsCount,
					index: {
						added: index.added,
						changed: index.changed,
						removed: index.removed,
						unchanged: index.unchanged,
						total: index.total,
					},
				},
				timestamp: new Date().toISOString(),
				currentVersion: packageJsonVersion,
			});
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
	});

	app.use((err: Error, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
		next(err);
	});

	const port = getEnvConfig().port;
	app.listen(port, () => {
		console.log(
			`${packageJsonName}@${packageJsonVersion} (Streamable HTTP) running on port ${port}.
Available endpoint: /mcp`,
		);
	});
}

function setOkResponse(res: Response, json: JsonValue): void {
	setResponse({ res, statusCode: 200, json });
}

function setInternalServerErrorResponse(res: Response, message: string = "Internal server error"): void {
	setResponse({ res, statusCode: 500, json: { error: { code: -32603, message } } });
}

function setMethodNotAllowedResponse(res: Response): void {
	setResponse({
		res,
		statusCode: 405,
		json: {
			error: {
				code: -32601,
				message: "Method not allowed",
			},
		},
	});
}

function setResponse({
	res,
	statusCode,
	json,
}: {
	readonly res: Response;
	readonly statusCode: 500 | 200 | 405;
	readonly json: JsonValue;
}): void {
	const jsonrpc = "2.0";
	if (statusCode === 405) {
		res.writeHead(statusCode).end({
			jsonrpc,
			json,
		});
	} else {
		res.status(statusCode).json({
			jsonrpc,
			json,
		});
	}
}
