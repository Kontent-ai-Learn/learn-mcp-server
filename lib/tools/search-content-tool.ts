import z from "zod";
import { searchResultSchema } from "../indexing/indexer.models.js";
import { search } from "../search/search.js";
import { defineReadOnlyTool } from "./shared/tool-definitions.js";
import { withStructuredToolHandler } from "./shared/tool-handler.js";
import type { ToolName } from "./shared/tool-models.js";

const toolName: ToolName = "search-content";

export const searchContentTool = defineReadOnlyTool({
	description:
		"Searches Kontent.ai Learn documentation and developer guides. Returns the most relevant documents in full, ordered by their semantic `score` (cosine similarity, 0–1, highest first) — the complete content is included, so you can answer the user's question directly without fetching the URLs.",
	handler: async ({ text }) =>
		await withStructuredToolHandler({
			handler: async () => ({ documents: [...(await search({ query: text }))] }),
			toolName,
		}),
	inputSchema: {
		text: z.compile(z.string().describe("The user's question or search query")),
	},
	name: toolName,
	outputSchema: {
		documents: z.array(searchResultSchema).readonly(),
	},
});
