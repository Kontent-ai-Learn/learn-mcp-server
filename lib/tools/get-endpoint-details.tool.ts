import z from "zod";
import { search } from "../database/search.js";
import type { EndpointReference } from "../indexing/indexer.models.js";
import type { SearchResult } from "../public_api.js";
import { defineReadOnlyTool } from "../tools-def/tool-definitions.js";
import { withToolHandler } from "../tools-def/tool-handler.js";
import type { ToolName } from "../tools-def/tool-models.js";

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
			handler: async () => {
				// first we try finding the proper endpoint
				const searchResults = await search(text);
				const endpointResults = searchResults.filter(isEndpointResult);
				const topResult = endpointResults.at(0);

				if (!topResult) {
					return "Could not find endpoint details for the given input.";
				}
				return [];
			},
		});
	},
);

function isEndpointResult(result: SearchResult): result is SearchResult & { endpoint: EndpointReference } {
	return result.endpoint !== null;
}
