import { cleanData } from "../lib/initialization/initialization.js";
import { runAndRecordSync } from "../lib/sync/sync-runner.js";

await cleanData({ isTest: false });
const { outcome } = await runAndRecordSync("CLI sync", { isTest: false });
if (!outcome.success) {
	throw outcome.error;
}
