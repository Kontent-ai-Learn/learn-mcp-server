import { runAndRecordSync } from "../lib/sync/sync-runner.js";
import { hasTestFlag, setTestEnv } from "../lib/utils/arg.utils.js";

const isTest = hasTestFlag(process.argv);
if (isTest) {
	setTestEnv();
}

const { outcome } = await runAndRecordSync("CLI sync", { isTest });
if (!outcome.success) {
	throw outcome.error;
}
