#!/usr/bin/env node
import { startStreamableHTTP } from "./transport/shttp.js";
import { startStdio } from "./transport/stdio.js";
import { getTransportTypeFromArg, transportTypes } from "./utils/arg.utils.js";
import { getErrorMessage } from "./utils/error.utils.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const transportType = getTransportTypeFromArg(args[0]);

	if (!transportType) {
		logger.log({ message: `Please specify a valid transport type: ${transportTypes.join(", ")}`, type: "error" });
		process.exit(1);
	}

	if (transportType === "stdio") {
		await startStdio();
		return;
	}

	if (transportType === "shttp") {
		startStreamableHTTP();
	}
}

try {
	await main();
} catch (error) {
	logger.log({ message: `Fatal error: ${getErrorMessage(error)}`, type: "error" });
	process.exit(1);
}
