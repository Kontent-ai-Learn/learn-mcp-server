#!/usr/bin/env node
import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { match } from "ts-pattern";
import { syncDatabase } from "./indexing/search.js";
import { createServer } from "./server.js";
import { getEnvConfig } from "./utils/environment.utils.js";
import { logger } from "./utils/logger.js";
import { packageJsonName, packageJsonVersion } from "./utils/version.js";

const transportTypes = ["stdio", "shttp"] as const;

type TransportType = (typeof transportTypes)[number];

function startStreamableHTTP() {
	const app = express();
	app.use(express.json());

	app.post("/mcp", async (req, res) => {
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
			logger.log({
				type: "error",
				message: `${packageJsonName}@${packageJsonVersion} - Error handling MCP request: ${error instanceof Error ? error.message : String(error)}`,
			});
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal server error",
					},
					id: null,
				});
			}
		}
	});

	app.get("/mcp", (_, res) => {
		res.writeHead(405).end(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Method not allowed.",
				},
				id: null,
			}),
		);
	});

	app.delete("/mcp", (_, res) => {
		res.writeHead(405).end(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Method not allowed.",
				},
				id: null,
			}),
		);
	});

	app.get("/health", (_, res) => {
		res.json({
			status: "ok",
			timestamp: new Date().toISOString(),
			currentVersion: packageJsonVersion,
		});
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

async function startStdio() {
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

async function main() {
	const args = process.argv.slice(2);

	const transportType = getTransportTypeFromArg(args[0]);

	if (!transportType) {
		logger.log({ type: "error", message: `Please specify a valid transport type: ${transportTypes.join(", ")}` });
		process.exit(1);
	}

	// Build the documentation index once, before serving any requests. The index
	// is a process-level singleton shared across all requests/tool calls.
	await syncDatabase();

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
