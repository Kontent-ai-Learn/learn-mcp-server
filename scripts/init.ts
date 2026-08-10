import { cleanData } from "../lib/initialization/initialization.js";
import { runAndRecordSync } from "../lib/sync/sync-runner.js";
import { hasTestFlag, setTestEnv } from "../lib/utils/arg.utils.js";

const isTest = hasTestFlag(process.argv);
if (isTest) {
	setTestEnv();
}

await cleanData({ isTest });
const { outcome } = await runAndRecordSync("CLI init", { isTest });
if (!outcome.success) {
	throw outcome.error;
}
