import { runAndRecordSync } from "../lib/sync/sync-runner.js";

process.env.IsTest = "true";

const { outcome } = await runAndRecordSync("CLI sync", { isTest: true });
if (!outcome.success) {
	throw outcome.error;
}
