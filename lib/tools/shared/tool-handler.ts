import { type JsonValue, tryCatchAsync } from "@kontent-ai/core-sdk";
import { getErrorMessage } from "../../utils/error.utils.js";
import type { McpToolErrorResponse, McpToolResponse, McpToolSuccessResponse, ToolName } from "./tool-models.js";

export async function withStructuredToolHandler<T extends Record<string, JsonValue>>({
	toolName,
	handler,
}: {
	readonly handler: () => Promise<T>;
	readonly toolName: ToolName;
}): Promise<McpToolResponse> {
	const { success, data, error } = await tryCatchAsync(async () => createMcpStructuredSuccessResponse(await handler()));

	if (success) {
		return data;
	}

	return handleMcpToolError(error, toolName);
}

/**
 * Tools declaring an `outputSchema` must return `structuredContent`, or the MCP SDK rejects the call.
 * The serialized JSON stays in `content` because not every client surfaces `structuredContent`.
 */
const createMcpStructuredSuccessResponse = <T extends Record<string, JsonValue>>(data: T): McpToolSuccessResponse => ({
	content: [
		{
			text: JSON.stringify(data),
			type: "text",
		},
	],
	structuredContent: data,
});

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
