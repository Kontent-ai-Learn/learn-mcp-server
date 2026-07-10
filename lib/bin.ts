#!/usr/bin/env node
import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Response } from "express";
import { match } from "ts-pattern";
import { syncDatabase } from "./indexing/indexer.js";
import { createServer } from "./server.js";
import { getEnvConfig } from "./utils/environment.utils.js";
import { getErrorMessage } from "./utils/error.utils.js";
import { logger } from "./utils/logger.js";
import { packageJsonName, packageJsonVersion } from "./utils/version.js";

const transportTypes = ["stdio", "shttp"] as const;

type TransportType = (typeof transportTypes)[number];

function startStreamableHTTP(): void {
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

	app.post("/index", async (_, res) => {
		const { success, error } = await tryCatchAsync(async () => {
			const { documentCount, changedCount, removedCount, unchangedCount } = await syncDatabase();

			setOkResponse(res, {
				message: `Successfully indexed '${documentCount}' documents.`,
				result: {
					changed: changedCount,
					removed: removedCount,
					unchanged: unchangedCount,
					total: documentCount,
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

async function startStdio(): Promise<void> {
	const { server } = createServer();
	const transport = new StdioServerTransport();
	logger.log({ type: "info", message: `${packageJsonName}@${packageJsonVersion} (stdio) starting` });
	await server.connect(transport);
}

function getTransportTypeFromArg(arg: string | undefined): TransportType | undefined {
	return match(arg?.toLowerCase())
		.returnType<TransportType | undefined>()
		.with("stdio" satisfies TransportType, () => "stdio")
		.with("shttp" satisfies TransportType, () => "shttp")
		.otherwise(() => {
			return undefined;
		});
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	const transportType = getTransportTypeFromArg(args[0]);

	if (!transportType) {
		logger.log({ type: "error", message: `Please specify a valid transport type: ${transportTypes.join(", ")}` });
		process.exit(1);
	}

	if (transportType === "stdio") {
		await startStdio();
		return;
	}

	if (transportType === "shttp") {
		startStreamableHTTP();
		return;
	}
}

main().catch((error) => {
	logger.log({ type: "error", message: `Fatal error: ${error instanceof Error ? error.message : String(error)}` });
	process.exit(1);
});
