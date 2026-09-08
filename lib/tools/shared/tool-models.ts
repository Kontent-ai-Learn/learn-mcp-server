import type { JsonValue } from "@kontent-ai/core-sdk";

export interface McpToolErrorResponse {
	[x: string]: unknown;
	content: {
		type: "text";
		text: string;
	}[];
	isError: true;
}

export interface McpToolSuccessResponse {
	[x: string]: unknown;
	content: {
		type: "text";
		text: string;
	}[];
	structuredContent?: Record<string, JsonValue>;
	isError?: false;
}

export type ToolName = "search-content" | "get-endpoint-details" | "get-object-details";

export type McpToolResponse = McpToolErrorResponse | McpToolSuccessResponse;
