import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export async function startStdio(): Promise<void> {
	const { server } = createServer();
	const transport = new StdioServerTransport();
	logger.log({ type: "info", message: `${packageJsonName}@${packageJsonVersion} (stdio) starting` });
	await server.connect(transport);
}
