import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { packageJsonVersion } from "./utils/version.js";
// import { allTools } from "./tools/index.js";

export const createServer = () => {
	const server = new McpServer({
		name: "kontent-ai",
		version: packageJsonVersion,
	});

	//   for (const tool of Object.values(allTools)) {
	//     server.registerTool(
	//       tool.name,
	//       {
	//         description: tool.description,
	//         inputSchema: tool.inputSchema,
	//         annotations: tool.annotations,
	//       },
	//       tool.handler,
	//     );
	//   }

	return { server };
};
