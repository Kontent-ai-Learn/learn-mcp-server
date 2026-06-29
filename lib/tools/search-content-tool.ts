import z from "zod";
import { defineReadOnlyTool } from "../core/tool-definitions.js";
import { withToolHandler } from "../core/tool-handler.js";
import type { ToolName } from "../core/tool-models.js";
import { search } from "../indexing/search.js";

const toolName: ToolName = "search-content";

export const searchContentTool = defineReadOnlyTool(
	toolName,
	"Searches Kontent.ai Learn documentation, API reference, and developer guides. Returns the most relevant documents in full (title, source URL, and complete content) so you can answer the user's question directly — there is no need to fetch the URLs.",
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
