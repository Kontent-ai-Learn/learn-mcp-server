import { cleanData } from "../lib/initialization/initialization.js";
import { runAndRecordSync } from "../lib/sync/sync-runner.js";

process.env.IsTest = "true";

await cleanData({ isTest: true });
const { outcome } = await runAndRecordSync("CLI sync", { isTest: true });
if (!outcome.success) {
	throw outcome.error;
}
