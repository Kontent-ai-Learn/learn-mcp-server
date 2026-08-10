import { runAndRecordSync } from "../lib/sync/sync-runner.js";

const { outcome } = await runAndRecordSync("CLI sync", { isTest: false });
if (!outcome.success) {
	throw outcome.error;
}
