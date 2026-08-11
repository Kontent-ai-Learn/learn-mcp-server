import { LearnMcpExceptionError } from "../exceptions/learn-mcp-exception.js";

let isSyncRunning = false;

export function acquireSyncLock(): void {
	if (isSyncRunning) {
		throw new LearnMcpExceptionError(
			"syncAlreadyRunning",
			"A sync is already running. Please wait for it to finish before starting another one.",
		);
	}
	isSyncRunning = true;
}

export function releaseSyncLock(): void {
	isSyncRunning = false;
}
