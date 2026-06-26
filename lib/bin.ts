#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { ensureIndexReady } from "./indexing/service.js";
import { createServer } from "./server.js";
import { getEnvConfig } from "./utils/environment.utils.js";
import { packageJsonName, packageJsonVersion } from "./utils/version.js";

function startStreamableHTTP() {
	const app = express();
	app.use(express.json());

	app.post("/mcp", async (req, res) => {
		try {
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
		} catch (error) {
			console.error(`${packageJsonName}@${packageJsonVersion} - Error handling MCP request:`, error);
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
	console.error(`${packageJsonName}@${packageJsonVersion} (stdio) starting`);
	await server.connect(transport);
}

async function main() {
	const args = process.argv.slice(2);
	const transportType = args[0]?.toLowerCase();

	if (!transportType || (transportType !== "stdio" && transportType !== "shttp")) {
		console.error("Please specify a valid transport type: stdio or shttp");
		process.exit(1);
	}

	// Build the documentation index once, before serving any requests. The index
	// is a process-level singleton shared across all requests/tool calls.
	await ensureIndexReady();

	if (transportType === "stdio") {
		await startStdio();
	} else if (transportType === "shttp") {
		startStreamableHTTP();
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
