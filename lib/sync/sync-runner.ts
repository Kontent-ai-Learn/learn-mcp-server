import { type TryCatchResult, tryCatchAsync } from "@kontent-ai/core-sdk";
import { DateTime } from "luxon";
import { type SyncResult, syncAll } from "../initialization/initialization.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { acquireSyncLock, releaseSyncLock } from "./sync-lock.js";
import { formatDuration, toIsoString } from "./sync-schedule.js";
import { writeSyncState } from "./sync-state.js";

export interface SyncRunResult {
	readonly startedAt: DateTime;
	readonly endedAt: DateTime;
	readonly durationMs: number;
	readonly outcome: TryCatchResult<SyncResult>;
}

export async function runAndRecordSync(label: string, options?: { readonly isTest?: boolean }): Promise<SyncRunResult> {
	acquireSyncLock();
	try {
		const syncResult = await syncAsync(label, options);
		logSyncResult(label, syncResult);

		return syncResult;
	} finally {
		releaseSyncLock();
	}
}

async function syncAsync(label: string, options?: { readonly isTest?: boolean }): Promise<SyncRunResult> {
	const startedAt = DateTime.now();
	logger.log({ message: `${label} starting...` });

	const syncResult = await tryCatchAsync(async () => await syncAll(options));
	const endedAt = DateTime.now();
	const durationMs = endedAt.diff(startedAt).as("milliseconds");

	return { durationMs, endedAt, outcome: syncResult, startedAt };
}

function logSyncResult(label: string, syncResult: SyncRunResult): void {
	writeSyncState({
		duration: formatDuration(syncResult.durationMs),
		durationMs: syncResult.durationMs,
		endedAt: toIsoString(syncResult.endedAt),
		startedAt: toIsoString(syncResult.startedAt),
		success: syncResult.outcome.success,
		...(syncResult.outcome.success ? { result: syncResult.outcome.data } : { error: getErrorMessage(syncResult.outcome.error) }),
	});

	logger.log({
		message: syncResult.outcome.success
			? `${label} completed in ${formatDuration(syncResult.durationMs)} (+${syncResult.outcome.data.index.added} ~${syncResult.outcome.data.index.changed} -${syncResult.outcome.data.index.removed}, ${syncResult.outcome.data.index.unchanged} unchanged).`
			: `${label} failed after ${formatDuration(syncResult.durationMs)}: ${getErrorMessage(syncResult.outcome.error)}`,
		type: syncResult.outcome.success ? "completed" : "error",
	});
}
