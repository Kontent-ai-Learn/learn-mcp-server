import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { LearnMcpExceptionError } from "../../exceptions/learn-mcp-exception.js";
import { runAndRecordSync, type SyncRunResult } from "../../sync/sync-runner.js";
import { packageJsonVersion } from "../../utils/version.js";
import { logAndRespondError, setConflictResponse, setOkResponse } from "./route.utils.js";

export async function handleSync(_req: Request, res: Response): Promise<void> {
	const { success, data, error } = await tryCatchAsync(async () => await runAndRecordSync("Manual sync"));

	if (!success) {
		respondWithSyncError(res, error);
		return;
	}

	respondWithSyncOutcome(res, data.outcome);
}

function respondWithSyncError(res: Response, error: unknown): void {
	if (error instanceof LearnMcpExceptionError) {
		setConflictResponse(res, { message: error.message, type: error.type });
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
