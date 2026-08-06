import { DateTime, Duration } from "luxon";
import { getSyncInterval } from "../config.js";
import type { SyncState } from "./models/sync-state.models.js";

export function computeNextSyncAt(lastSync: SyncState | undefined): DateTime {
	const now = DateTime.now();
	const baseline = lastSync ? DateTime.fromISO(lastSync.endedAt) : now;
	const candidate = baseline.plus(getSyncInterval());
	return candidate < now ? now : candidate;
}

export function toIsoString(dt: DateTime): string {
	return dt.toISO() ?? dt.toString();
}

export function formatDuration(durationMs: number): string {
	const human = Duration.fromMillis(durationMs)
		.shiftTo("hours", "minutes", "seconds")
		.toHuman({ maximumFractionDigits: 1, showZeros: false });
	return human || "0 seconds";
}
