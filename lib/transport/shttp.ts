import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type RequestHandler, type Response } from "express";
import { match } from "ts-pattern";
import { initializeAll } from "../initialization/initialization.js";
import { createServer } from "../server.js";
import { getEnvConfig } from "../utils/environment.utils.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

type SupportedRoute = {
	readonly method: "get" | "post";
	readonly path: string;
	readonly description: string;
	readonly handler: RequestHandler;
};

const supportedRoutes: readonly SupportedRoute[] = [
	{ method: "post", path: "/mcp", description: "MCP endpoint (Streamable HTTP).", handler: handleMcpRequest },
	{ method: "get", path: "/health", description: "Health check — status, timestamp, and version.", handler: handleHealth },
	{ method: "post", path: "/init", description: "(Re)build the search index from the configured Learn host.", handler: handleInit },
];

export function startStreamableHTTP(): void {
	const app = express();
	app.use(express.json());

	supportedRoutes.forEach(({ method, path, handler }) => {
		match(method)
			.with("get", () => app.get(path, handler))
			.with("post", () => app.post(path, handler))
			.exhaustive();
	});

	// Known path, unsupported method → 405 (the MCP transport is POST-only).
	app.get("/mcp", (_, res) => setMethodNotAllowedResponse(res));
	app.delete("/mcp", (_, res) => setMethodNotAllowedResponse(res));

	// Catch-all for any unmatched route (any method, any path). Registered after all
	// routes so it only handles the ones that fell through.
	app.use((req, res) => setNotFoundResponse(res, req.method, req.originalUrl));

	app.use((err: Error, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
		next(err);
	});

	const port = getEnvConfig().port;
	app.listen(port, () => {
		console.log(
			`${packageJsonName}@${packageJsonVersion} (Streamable HTTP) running on port ${port}.
Supported routes:
${formatSupportedRoutes()}`,
		);
	});
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
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

function handleHealth(_req: Request, res: Response): void {
	setOkResponse(res, {
		status: "ok",
		timestamp: new Date().toISOString(),
		currentVersion: packageJsonVersion,
	});
}

async function handleInit(_req: Request, res: Response): Promise<void> {
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
}

function setOkResponse(res: Response, json: JsonValue): void {
	setResponse({ res, statusCode: 200, json });
}

function setInternalServerErrorResponse(res: Response, message: string = "Internal server error"): void {
	setResponse({ res, statusCode: 500, json: { error: { code: -32603, message } } });
}

function setNotFoundResponse(res: Response, method: string, path: string): void {
	res.status(404).json({
		error: "Route not supported",
		message: `'${method} ${path}' is not a route on this MCP server. See 'supportedRoutes' for what's available.`,
		supportedRoutes: describeSupportedRoutes(),
	});
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
	res.status(statusCode).json({ jsonrpc: "2.0", json });
}

function describeSupportedRoutes(): readonly { readonly method: string; readonly path: string; readonly description: string }[] {
	return supportedRoutes.map(({ method, path, description }) => ({ method: method.toUpperCase(), path, description }));
}

function formatSupportedRoutes(): string {
	return describeSupportedRoutes()
		.map((route) => `  ${route.method.padEnd(4)} ${route.path} — ${route.description}`)
		.join("\n");
}
