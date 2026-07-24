import z from "zod";
import { getApiReferenceEndpointsFromCache } from "../content/api-reference-endpoints.js";
import { findDetailsBySearch } from "./shared/find-details-by-search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-endpoint-details";

export const getEndpointDetailsTools = defineReadOnlyTool(
	toolName,
	"Retrieves details for a requested endpoint. It includes the endpoint URL, title, description, code samples, request body schema, response body schema, query parameters and headers.",
	{
		text: z
			.string()
			.describe(
				"The endpoint for which you want to get details. It can be endpoint URL, endpoint title or description of the endpoint.",
			),
	},
	async ({ text }) => {
		return await withToolHandler({
			toolName,
			handler: async () =>
				await findDetailsBySearch({
					text,
					type: "endpoint",
					label: "endpoint",
					getRecordsFromCache: getApiReferenceEndpointsFromCache,
				}),
		});
	},
);
