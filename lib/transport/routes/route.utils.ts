import type { JsonValue } from "@kontent-ai/core-sdk";
import type { Response } from "express";

export function setOkResponse(res: Response, json: JsonValue): void {
	setResponse({ res, statusCode: 200, json });
}

export function setInternalServerErrorResponse(res: Response, message: string = "Internal server error"): void {
	setResponse({ res, statusCode: 500, json: { error: { code: -32603, message } } });
}

export function setMethodNotAllowedResponse(res: Response): void {
	setResponse({ res, statusCode: 405, json: { error: { code: -32601, message: "Method not allowed" } } });
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
