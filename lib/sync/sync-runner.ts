import { type TryCatchResult, tryCatchAsync } from "@kontent-ai/core-sdk";
import { DateTime } from "luxon";
import { type SyncResult, syncAll } from "../initialization/initialization.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { formatDuration, toIsoString } from "./sync-schedule.js";
import { writeSyncState } from "./sync-state.js";

export interface SyncRunResult {
	readonly startedAt: DateTime;
	readonly endedAt: DateTime;
	readonly durationMs: number;
	readonly outcome: TryCatchResult<SyncResult>;
}

export async function runAndRecordSync(label: string, options?: { readonly isTest?: boolean }): Promise<SyncRunResult> {
	const startedAt = DateTime.now();
	logger.log({ message: `${label} starting...` });

	const outcome = await tryCatchAsync(async () => await syncAll(options));
	const endedAt = DateTime.now();
	const durationMs = endedAt.diff(startedAt).as("milliseconds");

	writeSyncState({
		duration: formatDuration(durationMs),
		durationMs,
		endedAt: toIsoString(endedAt),
		startedAt: toIsoString(startedAt),
		success: outcome.success,
		...(outcome.success ? { result: outcome.data } : { error: getErrorMessage(outcome.error) }),
	});

	logger.log({
		message: outcome.success
			? `${label} completed in ${formatDuration(durationMs)} (+${outcome.data.index.added} ~${outcome.data.index.changed} -${outcome.data.index.removed}, ${outcome.data.index.unchanged} unchanged).`
			: `${label} failed after ${formatDuration(durationMs)}: ${getErrorMessage(outcome.error)}`,
		type: outcome.success ? "completed" : "error",
	});

	return { durationMs, endedAt, outcome, startedAt };
}
