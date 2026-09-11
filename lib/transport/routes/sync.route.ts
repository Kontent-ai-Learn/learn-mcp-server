import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { Duration } from "luxon";
import { runAndRecordSync, type SyncRunResult } from "../../sync/sync-runner.js";
import { withTimeout } from "../../utils/timeout.utils.js";
import { validateSyncToken } from "../../utils/token.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { respondWithError, respondWithOperationStillRunning, setOkResponse } from "../utils/route.utils.js";

const SYNC_WAIT_TIMEOUT = Duration.fromObject({ seconds: 5 });
const REQUEST_LABEL = "sync";

export async function handleSync(req: Request, res: Response): Promise<void> {
	const syncOutcome = tryCatchAsync(async () => {
		validateSyncToken(req);
		return await runAndRecordSync("Manual sync");
	});
	const raceResult = await withTimeout(syncOutcome, SYNC_WAIT_TIMEOUT);

	if (raceResult.kind === "timedOut") {
		respondWithOperationStillRunning({ operationLabel: "Sync", res });
		return;
	}

	const { success, data, error } = raceResult.value;

	if (!success) {
		respondWithError({ error, requestLabel: REQUEST_LABEL, res });
		return;
	}

	respondWithSyncOutcome(res, data.outcome);
}

function respondWithSyncOutcome(res: Response, outcome: SyncRunResult["outcome"]): void {
	if (!outcome.success) {
		respondWithError({ error: outcome.error, requestLabel: REQUEST_LABEL, res });
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
