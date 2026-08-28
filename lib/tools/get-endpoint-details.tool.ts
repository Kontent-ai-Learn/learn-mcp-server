import z from "zod";
import { apiReferenceCodenames } from "../config.js";
import { getEndpointDetails } from "../content/api-reference-details.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-endpoint-details";

export const getEndpointDetailsTools = defineReadOnlyTool({
	description:
		"Retrieves details for a requested Kontent.ai API endpoint. It includes the endpoint URL, title, description, code samples, request body schema, response body schema, query parameters and headers.",
	handler: async ({ text, apiReference }) =>
		await withToolHandler({
			handler: async () => await getEndpointDetails(text, apiReference),
			toolName,
		}),
	inputSchema: {
		apiReference: z
			.literal(apiReferenceCodenames)
			.optional()
			.describe(
				"Optional. The API reference for which you want to get details. It has to be one of the supported API reference codenames.",
			),
		text: z
			.string()
			.describe(
				"The endpoint for which you want to get details. It can be endpoint URL, endpoint title or description of the endpoint.",
			),
	},
	name: toolName,
});
