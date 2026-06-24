import z from "zod";
import { defineReadOnlyTool } from "../core/tool-definitions.js";
import { withToolHandler } from "../core/tool-handler.js";
import type { ToolName } from "../core/tool-models.js";

const toolName: ToolName = "search-content";

export const searchContentTool = defineReadOnlyTool(
	toolName,
	"Searches for content within Kontent.ai Learn documentation, API reference and developer guides.",
	{
		text: z.string().describe("Text to search for"),
	},
	async ({ text }) => {
		return await withToolHandler({
			toolName,
			handler: async () => {
				return await Promise.resolve(`Smurfer! - ${text}`);
			},
		});
	},
);
