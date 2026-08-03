import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allTools } from "./tools/index.js";
import { packageJsonName, packageJsonVersion } from "./utils/version.js";

export const createServer = (): { readonly server: McpServer } => {
	const server = new McpServer({
		name: packageJsonName,
		version: packageJsonVersion,
	});

	for (const tool of Object.values(allTools)) {
		server.registerTool(
			tool.name,
			{
				annotations: tool.annotations,
				description: tool.description,
				inputSchema: tool.inputSchema,
			},
			tool.handler,
		);
	}

	return { server };
};
