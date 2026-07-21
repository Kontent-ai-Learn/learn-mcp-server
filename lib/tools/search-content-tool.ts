import z from "zod";
import { search } from "../search/search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "search-content";

export const searchContentTool = defineReadOnlyTool(
	toolName,
	"Searches Kontent.ai Learn documentation and developer guides. Returns the most relevant documents in full (title, source URL, and complete content) so you can answer the user's question directly — there is no need to fetch the URLs.",
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
