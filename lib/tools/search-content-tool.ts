import z from "zod";
import { search } from "../search/search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "search-content";

export const searchContentTool = defineReadOnlyTool({
	description:
		"Searches Kontent.ai Learn documentation and developer guides. Returns the most relevant documents in full (title, source URL, and complete content) so you can answer the user's question directly — there is no need to fetch the URLs.",
	handler: async ({ text }) =>
		await withToolHandler({
			handler: async () => [...(await search({ query: text }))],
			toolName,
		}),
	inputSchema: {
		text: z.string().describe("The user's question or search query"),
	},
	name: toolName,
});
