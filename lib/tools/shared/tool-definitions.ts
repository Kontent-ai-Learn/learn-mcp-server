import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ToolName } from "./tool-models.js";

export interface ToolDefinition<Schema extends ZodRawShapeCompat = ZodRawShapeCompat> {
	readonly name: ToolName;
	readonly description: string;
	readonly inputSchema: Schema;
	readonly handler: ToolCallback<Schema>;
	readonly annotations: ToolAnnotations;
}

/**
 * Defines a read-only tool. Compliant MCP clients may run read-only tools without a confirmation prompt.
 */
export const defineReadOnlyTool = <Schema extends ZodRawShapeCompat>({
	name,
	description,
	inputSchema,
	handler,
}: {
	readonly name: ToolName;
	readonly description: string;
	readonly inputSchema: Schema;
	readonly handler: ToolCallback<Schema>;
}): ToolDefinition<Schema> => ({
	annotations: {
		destructiveHint: false,
		openWorldHint: false,
		readOnlyHint: true,
	},
	description,
	handler,
	inputSchema,
	name,
});
