import type { JsonValue } from "@kontent-ai/core-sdk";
import type { Application, RequestHandler, Response } from "express";
import { match } from "ts-pattern";

export type SupportedRoute = {
	readonly method: "get" | "post";
	readonly path: string;
	readonly description: string;
	readonly handler: RequestHandler;
};

/**
 * Registers each route's handler, then — for every supported path — a catch-all that answers
 * any *other* method with a friendly 405. Handlers are registered first so Express only falls
 * through to the 405 for methods no handler claimed (handlers end the response, never `next`).
 */
export function registerRoutes(app: Application, routes: readonly SupportedRoute[]): void {
	routes.forEach(({ method, path, handler }) => {
		match(method)
			.with("get", () => app.get(path, handler))
			.with("post", () => app.post(path, handler))
			.exhaustive();
	});

	methodsByPath(routes).forEach((methods, path) => {
		app.all(path, (req, res) => setMethodNotAllowedResponse(res, req.method, path, methods));
	});
}

export function setOkResponse(res: Response, json: JsonValue): void {
	setResponse({ res, statusCode: 200, json });
}

export function setInternalServerErrorResponse(res: Response, message: string = "Internal server error"): void {
	setResponse({ res, statusCode: 500, json: { error: { code: -32603, message } } });
}

function setMethodNotAllowedResponse(res: Response, attemptedMethod: string, path: string, supportedMethods: readonly string[]): void {
	res.status(405).json({
		error: "Method not allowed",
		message: `The path '${path}' does not support ${attemptedMethod}. Use ${supportedMethods.join(" or ")} instead.`,
		path,
		attemptedMethod,
		supportedMethods,
	});
}

function methodsByPath(routes: readonly SupportedRoute[]): ReadonlyMap<string, readonly string[]> {
	return routes.reduce((acc, { method, path }) => {
		const existing = acc.get(path) ?? [];
		return acc.set(path, [...existing, method.toUpperCase()]);
	}, new Map<string, readonly string[]>());
}

function setResponse({
	res,
	statusCode,
	json,
}: {
	readonly res: Response;
	readonly statusCode: 200 | 500;
	readonly json: JsonValue;
}): void {
	res.status(statusCode).json({ jsonrpc: "2.0", json });
}
