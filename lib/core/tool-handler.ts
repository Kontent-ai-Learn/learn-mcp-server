import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import type { McpToolErrorResponse, McpToolResponse, McpToolSuccessResponse, ToolName } from "./tool-models.js";

export async function withToolHandler({
	toolName,
	handler,
}: {
	readonly handler: () => Promise<JsonValue>;
	readonly toolName: ToolName;
}): Promise<McpToolResponse> {
	const { success, data, error } = await tryCatchAsync(async () => {
		return createMcpToolSuccessResponse(await handler());
	});

	if (success) {
		return data;
	}

	return handleMcpToolError(error, toolName);
}

/**
 * Converts data to MCP tool success response format.
 * Handles undefined separately as JSON.stringify(undefined) returns undefined (not a string).
 * Skips stringify for strings as they don't need JSON encoding for MCP text response.
 */
const createMcpToolSuccessResponse = (data: JsonValue): McpToolSuccessResponse => {
	const text = data === undefined ? "undefined" : typeof data === "string" ? data : JSON.stringify(data);

	return {
		content: [
			{
				type: "text",
				text,
			},
		],
	};
};

/**
 * Handles various types of errors and returns a standardized MCP tool error response
 * @param error The error to handle
 * @param context Optional context string to include in error message
 * @returns Standardized MCP tool error response
 */
const handleMcpToolError = (error: unknown, context?: string): McpToolErrorResponse => {
	const contextPrefix = context ? `${context}: ` : "";

	return {
		content: [
			{
				type: "text",
				text: `${contextPrefix}Unexpected error: ${error instanceof Error ? error.message : "Unknown error occurred"}\n\nFull error: ${JSON.stringify(error)}`,
			},
		],
		isError: true,
	};
};
