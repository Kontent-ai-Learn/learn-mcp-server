import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { Duration } from "luxon";
import { match } from "ts-pattern";
import { LearnMcpExceptionError } from "../../exceptions/learn-mcp-exception.js";
import { cleanData } from "../../initialization/initialization.js";
import { getEnvConfig } from "../../utils/environment.utils.js";
import { withTimeout } from "../../utils/timeout.utils.js";
import { validateSyncToken } from "../../utils/token.utils.js";
import { packageJsonVersion } from "../../utils/version.js";
import { logAndRespondError, setAcceptedResponse, setConflictResponse, setOkResponse, setUnauthorizedResponse } from "./route.utils.js";

const CLEAN_WAIT_TIMEOUT = Duration.fromObject({ seconds: 20 });

export async function handleClean(req: Request, res: Response): Promise<void> {
	validateSyncToken(req);
	const cleanOutcome = tryCatchAsync(async () => {
		await cleanData({ isTest: getEnvConfig().isTest });
		return true;
	});
	const raceResult = await withTimeout(cleanOutcome, CLEAN_WAIT_TIMEOUT);

	if (raceResult.kind === "timedOut") {
		respondWithSyncStillRunning(res);
		return;
	}

	const { success, data, error } = raceResult.value;

	if (!success) {
		respondWithSyncError(res, error);
		return;
	}

	respondWithSyncOutcome(res, data);
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

function respondWithSyncOutcome(res: Response, isSuccess: boolean): void {
	setOkResponse(res, {
		currentVersion: packageJsonVersion,
		message: isSuccess ? `Successfully cleaned data.` : `Failed to clean data.`,
		timestamp: new Date().toISOString(),
	});
}
