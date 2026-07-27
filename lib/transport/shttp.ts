import express, { type Response } from "express";
import { getEnvConfig } from "../utils/environment.utils.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";
import { handleHealth } from "./routes/health.route.js";
import { handleInit } from "./routes/init.route.js";
import { handleMcpRequest } from "./routes/mcp.route.js";
import { registerRoutes, type SupportedRoute } from "./routes/route.utils.js";

const supportedRoutes: readonly SupportedRoute[] = [
	{ method: "post", path: "/mcp", description: "MCP endpoint (Streamable HTTP).", handler: handleMcpRequest },
	{ method: "get", path: "/health", description: "Health check — status, timestamp, and version.", handler: handleHealth },
	{ method: "post", path: "/init", description: "(Re)build the search index from the configured Learn host.", handler: handleInit },
];

export function startStreamableHTTP(): void {
	const app = express();
	app.use(express.json());

	// Registers each handler plus an automatic friendly 405 for any other method on a
	// supported path.
	registerRoutes(app, supportedRoutes);

	// Catch-all for any unmatched path (any method). Registered after all routes so it only
	// handles the ones that fell through.
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

function setNotFoundResponse(res: Response, method: string, path: string): void {
	res.status(404).json({
		error: "Route not supported",
		message: `'${method} ${path}' is not a route on this MCP server. See 'supportedRoutes' for what's available.`,
		supportedRoutes: describeSupportedRoutes(),
	});
}

/** Public view of the routes for responses/logs — omits the internal `handler`. */
function describeSupportedRoutes(): readonly { readonly method: string; readonly path: string; readonly description: string }[] {
	return supportedRoutes.map(({ method, path, description }) => ({ method: method.toUpperCase(), path, description }));
}

function formatSupportedRoutes(): string {
	return describeSupportedRoutes()
		.map((route) => `  ${route.method.padEnd(4)} ${route.path} — ${route.description}`)
		.join("\n");
}
