import type { Request, Response } from "express";
import { DateTime } from "luxon";
import { computeNextSyncAt, toIsoString, toRelativeDateTimeString } from "../../sync/sync-schedule.js";
import { readSyncState } from "../../sync/sync-state.js";
import { getEnvConfig } from "../../utils/environment.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { setOkResponse } from "./route.utils.js";

export function handleHealth(_req: Request, res: Response): void {
	const { autoSyncEnabled, syncIntervalValue, syncIntervalUnit } = getEnvConfig();
	const lastSync = readSyncState();
	const humanizedLastSync = lastSync
		? {
				...lastSync,
				ended: toRelativeDateTimeString(DateTime.fromISO(lastSync.endedAt)),
				started: toRelativeDateTimeString(DateTime.fromISO(lastSync.startedAt)),
			}
		: undefined;
	const nextSyncAt = autoSyncEnabled ? computeNextSyncAt(lastSync) : undefined;

	setOkResponse(res, {
		currentVersion: packageJsonVersion,
		status: "ok",
		sync: {
			enabled: autoSyncEnabled,
			interval: { unit: syncIntervalUnit, value: syncIntervalValue },
			lastSync: humanizedLastSync,
			nextSync: nextSyncAt
				? {
						scheduled: toRelativeDateTimeString(nextSyncAt),
						scheduledAt: toIsoString(nextSyncAt),
					}
				: undefined,
		},
		timestamp: new Date().toISOString(),
	});
}
