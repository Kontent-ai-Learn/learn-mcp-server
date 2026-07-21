import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ToolName } from "./tool-models.js";

export type ToolDefinition<Schema extends ZodRawShapeCompat = ZodRawShapeCompat> = {
	readonly name: ToolName;
	readonly description: string;
	readonly inputSchema: Schema;
	readonly handler: ToolCallback<Schema>;
	readonly annotations: ToolAnnotations;
};

/**
 * Defines a read-only tool. Compliant MCP clients may run read-only tools without a confirmation prompt.
 */
export const defineReadOnlyTool = <Schema extends ZodRawShapeCompat>(
	name: ToolName,
	description: string,
	inputSchema: Schema,
	handler: ToolCallback<Schema>,
): ToolDefinition<Schema> => ({
	name,
	description,
	inputSchema,
	handler,
	// openWorldHint: false — every tool operates on the configured Kontent.ai
	// environment only (a closed domain).
	annotations: {
		readOnlyHint: true,
		destructiveHint: false,
		openWorldHint: false,
	},
});
