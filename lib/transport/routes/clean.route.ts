import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { Duration } from "luxon";
import { cleanData } from "../../initialization/initialization.js";
import { getEnvConfig } from "../../utils/environment.utils.js";
import { withTimeout } from "../../utils/timeout.utils.js";
import { validateSyncToken } from "../../utils/token.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { respondWithError, respondWithOperationStillRunning, setOkResponse } from "../utils/route.utils.js";

const CLEAN_WAIT_TIMEOUT = Duration.fromObject({ seconds: 20 });
const REQUEST_LABEL = "clean";

export async function handleClean(req: Request, res: Response): Promise<void> {
	const cleanOutcome = tryCatchAsync(async () => {
		validateSyncToken(req);
		await cleanData({ isTest: getEnvConfig().isTest });
		return true;
	});
	const raceResult = await withTimeout(cleanOutcome, CLEAN_WAIT_TIMEOUT);

	if (raceResult.kind === "timedOut") {
		respondWithOperationStillRunning({ operationLabel: "Cleanup", res });
		return;
	}

	const { success, data, error } = raceResult.value;

	if (!success) {
		respondWithError({ error, requestLabel: REQUEST_LABEL, res });
		return;
	}

	respondWithCleanOutcome(res, data);
}

function respondWithCleanOutcome(res: Response, isSuccess: boolean): void {
	setOkResponse(res, {
		currentVersion: packageJsonVersion,
		message: isSuccess ? `Successfully cleaned data.` : `Failed to clean data.`,
		timestamp: new Date().toISOString(),
	});
}
