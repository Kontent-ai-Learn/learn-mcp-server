import z from "zod";
import { apiReferenceCodenames } from "../config.js";
import { getEndpointDetails } from "../content/api-reference-details.js";
import { publicApiReferenceEndpointSchema } from "../content/models/public-api-reference-endpoints.models.js";
import { mapRecordToPublicApiReferenceEndpoint } from "../content/utils/public-api-reference-endpoint-mapper.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withStructuredToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-endpoint-details";

export const getEndpointDetailsTools = defineReadOnlyTool({
	description:
		"Retrieves details for Kontent.ai API endpoints matching the input text. Returns an array of the most likely candidates, ordered by their semantic `score` (0–1, highest first; title and body relevance combined) — use the score to judge how confident a match is. An empty array means nothing matched closely enough.",
	handler: async ({ text, apiReference }) =>
		await withStructuredToolHandler({
			handler: async () => ({
				candidates: await getEndpointDetails({
					text,
					apiReference,
					mapRecordToPublicType: mapRecordToPublicApiReferenceEndpoint,
				}),
			}),
			toolName,
		}),
	inputSchema: {
		apiReference: z.compile(
			z
				.literal(apiReferenceCodenames)
				.optional()
				.describe(
					"Optional. The API reference for which you want to get details. It has to be one of the supported API reference codenames.",
				),
		),
		text: z.compile(
			z
				.string()
				.describe(
					"The endpoint for which you want to get details. It can be endpoint URL, endpoint title or description of the endpoint.",
				),
		),
	},
	name: toolName,
	outputSchema: {
		candidates: z.array(publicApiReferenceEndpointSchema).readonly(),
	},
});
