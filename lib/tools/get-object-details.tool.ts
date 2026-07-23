import z from "zod";
import { getApiReferenceObjectsFromCache } from "../content/api-reference-objects.js";
import { findDetailsBySearch } from "./shared/find-details-by-search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "get-object-details";

export const getObjectDetailsTools = defineReadOnlyTool(
	toolName,
	"Retrieves details for a requested API reference object. It includes the object's URL, title, description, the API it belongs to, and its properties (name, type, description, modifiers and nested properties).",
	{
		text: z.string().describe("The object for which you want to get details. It can object title or a description of the object."),
	},
	async ({ text }) => {
		return await withToolHandler({
			toolName,
			handler: async () =>
				await findDetailsBySearch({ text, type: "object", label: "object", getRecordsFromCache: getApiReferenceObjectsFromCache }),
		});
	},
);
