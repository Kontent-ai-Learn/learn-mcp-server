import z from "zod";
import { apiReferenceCodenames } from "../config.js";
import { getObjectDetails } from "../content/api-reference-details.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-object-details";

export const getObjectDetailsTools = defineReadOnlyTool({
	description:
		"Retrieves details for a requested Kontent.ai API reference object. It includes the object's URL, title, description, the API it belongs to, and its properties (name, type, description, modifiers and nested properties).",
	handler: async ({ text, apiReference }) =>
		await withToolHandler({
			handler: async () => await getObjectDetails(text, apiReference),
			toolName,
		}),
	inputSchema: {
		apiReference: z
			.literal(apiReferenceCodenames)
			.optional()
			.describe(
				"Optional. The API reference for which you want to get details. It has to be one of the supported API reference codenames.",
			),
		text: z.string().describe("The object for which you want to get details. It can object title or a description of the object."),
	},
	name: toolName,
});
