import { DateTime } from "luxon";
import { getSyncInterval } from "../config.js";
import { getEnvConfig } from "../utils/environment.utils.js";
import { getErrorMessage } from "../utils/error.utils.js";
import { logger } from "../utils/logger.js";
import { runAndRecordSync } from "./sync-runner.js";
import { computeNextSyncAt, toIsoString } from "./sync-schedule.js";
import { readSyncState } from "./sync-state.js";

export function startAutoSyncIfEnabled(): void {
	const { autoSyncEnabled, syncIntervalValue, syncIntervalUnit } = getEnvConfig();
	if (!autoSyncEnabled) {
		logger.log({ message: "Automatic sync is disabled (set AutoSyncEnabled=true in .env to enable)." });
		return;
	}

	const nextSyncAt = computeNextSyncAt(readSyncState());
	logger.log({
		message: `Automatic sync is enabled (every ${syncIntervalValue} ${syncIntervalUnit}). Next sync ${nextSyncAt.toRelative()} (${toIsoString(nextSyncAt)}).`,
	});
	scheduleSyncAt(nextSyncAt);
}

function scheduleSyncAt(at: DateTime): void {
	const delayMs = Math.max(0, at.diff(DateTime.now()).as("milliseconds"));
	setTimeout(() => {
		runSyncAndReschedule().catch((error: unknown) => {
			logger.log({ message: `Automatic sync loop crashed: ${getErrorMessage(error)}`, type: "error" });
		});
	}, delayMs);
}

async function runSyncAndReschedule(): Promise<void> {
	const { endedAt } = await runAndRecordSync("Automatic sync");
	scheduleSyncAt(endedAt.plus(getSyncInterval()));
}
