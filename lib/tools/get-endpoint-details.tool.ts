import z from "zod";
import { search } from "../database/search.js";
import { defineReadOnlyTool } from "../tools-def/tool-definitions.js";
import { withToolHandler } from "../tools-def/tool-handler.js";
import type { ToolName } from "../tools-def/tool-models.js";

const toolName: ToolName = "get-endpoint-details";

export const getEndpointDetailsTools = defineReadOnlyTool(
	toolName,
	"",
	{
		text: z.string().describe("The user's question or search query"),
	},
	async ({ text }) => {
		return await withToolHandler({
			toolName,
			handler: async () => [...(await search(text))],
		});
	},
);
