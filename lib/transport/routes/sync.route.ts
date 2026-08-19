import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { Duration } from "luxon";
import { match } from "ts-pattern";
import { LearnMcpExceptionError } from "../../exceptions/learn-mcp-exception.js";
import { runAndRecordSync, type SyncRunResult } from "../../sync/sync-runner.js";
import { withTimeout } from "../../utils/timeout.utils.js";
import { validateSyncToken } from "../../utils/token.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { logAndRespondError, setAcceptedResponse, setConflictResponse, setOkResponse, setUnauthorizedResponse } from "./route.utils.js";

const SYNC_WAIT_TIMEOUT = Duration.fromObject({ seconds: 5 });

export async function handleSync(req: Request, res: Response): Promise<void> {
	const syncOutcome = tryCatchAsync(async () => {
		validateSyncToken(req);
		return await runAndRecordSync("Manual sync");
	});
	const raceResult = await withTimeout(syncOutcome, SYNC_WAIT_TIMEOUT);

	if (raceResult.kind === "timedOut") {
		respondWithSyncStillRunning(res);
		return;
	}

	const { success, data, error } = raceResult.value;

	if (!success) {
		respondWithSyncError(res, error);
		return;
	}

	respondWithSyncOutcome(res, data.outcome);
}

function respondWithSyncStillRunning(res: Response): void {
	setAcceptedResponse(res, {
		currentVersion: packageJsonVersion,
		message: "Sync is still running in the background. Check results later.",
		timestamp: new Date().toISOString(),
	});
}

function respondWithSyncError(res: Response, error: unknown): void {
	if (error instanceof LearnMcpExceptionError) {
		match(error.type)
			.with("syncAlreadyRunning", () => {
				setConflictResponse(res, { message: error.message, type: error.type });
			})
			.with("unauthorized", () => {
				setUnauthorizedResponse(res, { message: error.message, type: error.type });
			})
			.exhaustive();
		return;
	}
	logAndRespondError({ error, requestLabel: "sync", res });
}

function respondWithSyncOutcome(res: Response, outcome: SyncRunResult["outcome"]): void {
	if (!outcome.success) {
		logAndRespondError({ error: outcome.error, requestLabel: "sync", res });
		return;
	}

	const { dbName, searchRecordsCount, apiReferenceEndpointsCount, apiReferenceObjectsCount, index } = outcome.data;
	setOkResponse(res, {
		currentVersion: packageJsonVersion,
		message: `Successfully indexed '${index.total}' documents into '${dbName}'.`,
		result: {
			apiReferenceEndpointsCount,
			apiReferenceObjectsCount,
			dbName,
			index: {
				added: index.added,
				changed: index.changed,
				removed: index.removed,
				total: index.total,
				unchanged: index.unchanged,
			},
			searchRecordsCount,
		},
		timestamp: new Date().toISOString(),
	});
}
