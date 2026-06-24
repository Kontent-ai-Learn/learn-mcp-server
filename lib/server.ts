import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allTools } from "./tools/index.js";
import { packageJsonName, packageJsonVersion } from "./utils/version.js";

export const createServer = () => {
	const server = new McpServer({
		name: packageJsonName,
		version: packageJsonVersion,
	});

	for (const tool of Object.values(allTools)) {
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: tool.annotations,
			},
			tool.handler,
		);
	}

	return { server };
};
