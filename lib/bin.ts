#!/usr/bin/env node
import { startStreamableHTTP } from "./transport/shttp.js";
import { startStdio } from "./transport/stdio.js";
import { getTransportTypeFromArg, transportTypes } from "./utils/arg.utils.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const transportType = getTransportTypeFromArg(args[0]);

	if (!transportType) {
		logger.log({ type: "error", message: `Please specify a valid transport type: ${transportTypes.join(", ")}` });
		process.exit(1);
	}

	if (transportType === "stdio") {
		await startStdio();
		return;
	}

	if (transportType === "shttp") {
		startStreamableHTTP();
		return;
	}
}

main().catch((error) => {
	logger.log({ type: "error", message: `Fatal error: ${error instanceof Error ? error.message : String(error)}` });
	process.exit(1);
});
