import z from "zod";
import { getApiReferenceEndpointsFromCache } from "../content/api-reference-endpoints.js";
import { findDetailsBySearch } from "./shared/find-details-by-search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-endpoint-details";

export const getEndpointDetailsTools = defineReadOnlyTool({
	description:
		"Retrieves details for a requested endpoint. It includes the endpoint URL, title, description, code samples, request body schema, response body schema, query parameters and headers.",
	handler: async ({ text }) =>
		await withToolHandler({
			handler: async () =>
				await findDetailsBySearch({
					getRecordsFromCache: getApiReferenceEndpointsFromCache,
					label: "endpoint",
					text,
					type: "endpoint",
				}),
			toolName,
		}),
	inputSchema: {
		text: z
			.string()
			.describe(
				"The endpoint for which you want to get details. It can be endpoint URL, endpoint title or description of the endpoint.",
			),
	},
	name: toolName,
});
