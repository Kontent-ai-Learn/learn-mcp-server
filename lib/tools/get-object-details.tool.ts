import z from "zod";
import { apiReferenceCodenames } from "../config.js";
import { getObjectDetails } from "../content/api-reference-details.js";
import { publicApiReferenceObjectSchema } from "../content/models/public-api-reference-objects.models.js";
import { mapRecordToPublicApiReferenceObject } from "../content/utils/public-api-reference-object-mapper.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withStructuredToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-object-details";

export const getObjectDetailsTools = defineReadOnlyTool({
	description:
		"Retrieves details for Kontent.ai API reference objects matching the input text. Returns an array of the most likely candidates, ordered by their semantic `score` (0–1, highest first; title and body relevance combined) — use the score to judge how confident a match is. An empty array means nothing matched closely enough.",
	handler: async ({ text, apiReference }) =>
		await withStructuredToolHandler({
			handler: async () => ({
				candidates: await getObjectDetails({ text, apiReference, mapRecordToPublicType: mapRecordToPublicApiReferenceObject }),
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
			z.string().describe("The object for which you want to get details. It can be object title or a description of the object."),
		),
	},
	name: toolName,
	outputSchema: {
		candidates: z.array(publicApiReferenceObjectSchema).readonly(),
	},
});
