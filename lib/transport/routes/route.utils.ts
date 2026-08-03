import type { JsonValue } from "@kontent-ai/core-sdk";
import type { Application, RequestHandler, Response } from "express";
import { match } from "ts-pattern";

export interface SupportedRoute {
	readonly method: "get" | "post";
	readonly path: string;
	readonly description: string;
	readonly handler: RequestHandler;
}

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
		app.all(path, (req, res) => {
			setMethodNotAllowedResponse({ attemptedMethod: req.method, path, res, supportedMethods: methods });
		});
	});
}

export function setOkResponse(res: Response, json: JsonValue): void {
	setResponse({ json, res, statusCode: 200 });
}

export function setInternalServerErrorResponse(res: Response, message = "Internal server error"): void {
	setResponse({ json: { error: { code: -32_603, message } }, res, statusCode: 500 });
}

function setMethodNotAllowedResponse({
	res,
	attemptedMethod,
	path,
	supportedMethods,
}: {
	readonly res: Response;
	readonly attemptedMethod: string;
	readonly path: string;
	readonly supportedMethods: readonly string[];
}): void {
	res.status(405).json({
		attemptedMethod,
		error: "Method not allowed",
		message: `The path '${path}' does not support ${attemptedMethod}. Use ${supportedMethods.join(" or ")} instead.`,
		path,
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
	res.status(statusCode).json({ json, jsonrpc: "2.0" });
}
