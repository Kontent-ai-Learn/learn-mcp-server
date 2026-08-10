import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import { match, P } from "ts-pattern";
import { getErrorMessage } from "../../utils/error.utils.js";
import type { McpToolErrorResponse, McpToolResponse, McpToolSuccessResponse, ToolName } from "./tool-models.js";

export async function withToolHandler({
	toolName,
	handler,
}: {
	readonly handler: () => Promise<JsonValue>;
	readonly toolName: ToolName;
}): Promise<McpToolResponse> {
	const { success, data, error } = await tryCatchAsync(async () => createMcpToolSuccessResponse(await handler()));

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
	// Matched as `unknown` because `JsonValue` is deeply recursive and overflows
	const text = match<unknown>(data)
		.returnType<string>()
		.with(undefined, () => "undefined")
		.with(P.string, (value) => value)
		.otherwise((value) => JSON.stringify(value));

	return {
		content: [
			{
				text,
				type: "text",
			},
		],
	};
};

/**
 * Handles various types of errors and returns a standardized MCP tool error response
 * @param error The error to handle
 * @param toolName The name of the tool that failed (used to prefix the error message)
 * @returns Standardized MCP tool error response
 */
const handleMcpToolError = (error: unknown, toolName: ToolName): McpToolErrorResponse => ({
	content: [
		{
			text: `${toolName}: Unexpected error: ${getErrorMessage(error)}
Full error: ${JSON.stringify(error)}`,
			type: "text",
		},
	],
	isError: true,
});
