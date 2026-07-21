import z from "zod";
import { getOrSetFromMemoryCache } from "../cache/memory-cache.js";
import { type ApiReferenceRecord, apiReferenceRecordSchema, fetchApiReferenceRecords } from "../content/api-reference-records.js";
import { search } from "../search/search.js";
import { getErrorMessage } from "../utils/error.utils.js";
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
			handler: async () => {
				// first try finding the proper endpoint
				const searchResults = await search(text);
				const endpointResults = searchResults.filter((m) => m.type === "endpoint");
				const topResult = endpointResults.at(0);

				if (!topResult) {
					return "Could not find endpoint details for the given input.";
				}

				// take the top result and return its details
				const apiReferenceRecordsOrMessage = await getApiReferenceRecordsFromCache();

				if (!isApiReferenceRecords(apiReferenceRecordsOrMessage)) {
					return `Could not fetch learn records. Error: ${apiReferenceRecordsOrMessage}`;
				}

				const fullDetails = apiReferenceRecordsOrMessage.find((record) => record.codename === topResult.codename);

				if (!fullDetails) {
					return `Found candidate endpoint but could not retrieve its details. Requested codename: ${topResult.codename}`;
				}

				return fullDetails;
			},
		});
	},
);

async function getApiReferenceRecordsFromCache(): Promise<readonly ApiReferenceRecord[] | string> {
	return await getOrSetFromMemoryCache<readonly ApiReferenceRecord[] | string>({
		key: "api-reference-records",
		schema: z.union([z.readonly(z.array(apiReferenceRecordSchema)), z.string()]),
		value: async () => {
			const { success, data, error } = await fetchApiReferenceRecords();

			if (!success) {
				return `Could not fetch learn records. Error: ${getErrorMessage(error)}`;
			}

			return data;
		},
	});
}

function isApiReferenceRecords(value: readonly ApiReferenceRecord[] | string): value is readonly ApiReferenceRecord[] {
	return Array.isArray(value);
}
