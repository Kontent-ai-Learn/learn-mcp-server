import type { Request, Response } from "express";
import { computeNextSyncAt, toIsoString } from "../../sync/sync-schedule.js";
import { readSyncState } from "../../sync/sync-state.js";
import { getEnvConfig } from "../../utils/environment.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { setOkResponse } from "./route.utils.js";

export function handleHealth(_req: Request, res: Response): void {
	const { autoSyncEnabled, syncIntervalValue, syncIntervalUnit } = getEnvConfig();
	const lastSync = readSyncState();

	setOkResponse(res, {
		currentVersion: packageJsonVersion,
		status: "ok",
		sync: {
			enabled: autoSyncEnabled,
			interval: { unit: syncIntervalUnit, value: syncIntervalValue },
			lastSync,
			nextSyncAt: autoSyncEnabled ? toIsoString(computeNextSyncAt(lastSync)) : undefined,
		},
		timestamp: new Date().toISOString(),
	});
}
