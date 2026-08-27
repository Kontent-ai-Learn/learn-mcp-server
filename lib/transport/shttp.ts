import compression from "compression";
import cors from "cors";
import express, { type Response } from "express";
import { warmupEmbeddingPipeline } from "../indexing/embeddings.js";
import { startAutoSyncIfEnabled } from "../sync/auto-sync.js";
import { getEnvConfig } from "../utils/environment.utils.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";
import { handleEndpointDetails } from "./routes/endpoint-details.route.js";
import { handleHealth } from "./routes/health.route.js";
import { handleMcpRequest } from "./routes/mcp.route.js";
import { handleObjectDetails } from "./routes/object-details.route.js";
import { registerRoutes, type SupportedRoute } from "./routes/route.utils.js";
import { handleSearch } from "./routes/search.route.js";
import { handleSync } from "./routes/sync.route.js";

const supportedRoutes: readonly SupportedRoute[] = [
	{ description: "MCP endpoint (Streamable HTTP).", handler: handleMcpRequest, method: "post", path: "/mcp" },
	{ description: "Health check — status, timestamp, and version.", handler: handleHealth, method: "get", path: "/health" },
	{ description: "Searches Kontent.ai Learn documentation and developer guides.", handler: handleSearch, method: "get", path: "/search" },
	{
		description: "Retrieves details for a requested API endpoint.",
		handler: handleEndpointDetails,
		method: "get",
		path: "/endpoint-details",
	},
	{
		description: "Retrieves details for a requested API reference object.",
		handler: handleObjectDetails,
		method: "get",
		path: "/object-details",
	},
	{ description: "(Re)build the search index from the configured Learn host.", handler: handleSync, method: "post", path: "/sync" },
];

// Public, unauthenticated, read-only API — safe to allow any origin. Browser-based clients
// (e.g. Claude Desktop's connector UI) preflight non-simple requests with OPTIONS; without
// This, that preflight fell through to the 405 handler with no CORS headers and the browser
// Silently blocked every real request.
const corsOptions: cors.CorsOptions = {
	allowedHeaders: ["Content-Type", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version"],
	methods: ["GET", "POST", "OPTIONS"],
	origin: "*",
};

export function startStreamableHTTP(): void {
	const app = express();
	app.use(cors(corsOptions));
	app.use(compression());
	app.use(express.json());

	// Registers each handler plus an automatic friendly 405 for any other method on a
	// Supported path.
	registerRoutes(app, supportedRoutes);

	// Catch-all for any unmatched path (any method). Registered after all routes so it only
	// Handles the ones that fell through.
	app.use((req, res) => {
		setNotFoundResponse(res, req.method, req.originalUrl);
	});

	// Express detects error-handling middleware by arity (exactly 4 declared params) — an
	// Object param would collapse this to arity 1 and Express would treat it as regular
	// Middleware instead, so this signature can't be refactored like the others.
	// oxlint-disable-next-line max-params
	app.use((err: Error, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
		next(err);
	});

	const { port } = getEnvConfig();
	app.listen(port, () => {
		console.log(
			`${packageJsonName}@${packageJsonVersion} (Streamable HTTP) running on port ${port}.
Supported routes:
${formatSupportedRoutes()}`,
		);
		startAutoSyncIfEnabled();
		warmupEmbeddingPipeline().catch((error: unknown) => {
			logger.log({ message: `Failed to warm up the embedding pipeline: ${getErrorMessage(error)}`, type: "error" });
		});
	});
}

function setNotFoundResponse(res: Response, method: string, path: string): void {
	res.status(404).json({
		error: "Route not supported",
		message: `'${method} ${path}' is not a route on this MCP server. See 'supportedRoutes' for what's available.`,
		supportedRoutes: describeSupportedRoutes(),
	});
}

function describeSupportedRoutes(): readonly { readonly method: string; readonly path: string; readonly description: string }[] {
	return supportedRoutes.map(({ method, path, description }) => ({ description, method: method.toUpperCase(), path }));
}

function formatSupportedRoutes(): string {
	return describeSupportedRoutes()
		.map((route) => `  ${route.method.padEnd(4)} ${route.path} — ${route.description}`)
		.join("\n");
}
