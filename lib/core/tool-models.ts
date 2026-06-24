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

export type ToolName = "search-content";

export type McpToolResponse = McpToolErrorResponse | McpToolSuccessResponse;
