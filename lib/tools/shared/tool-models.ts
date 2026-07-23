export type McpToolErrorResponse = {
	[x: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError: true;
};

export type McpToolSuccessResponse = {
	[x: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: false;
};

export type ToolName = "search-content" | "get-endpoint-details" | "get-object-details";

export type McpToolResponse = McpToolErrorResponse | McpToolSuccessResponse;
