import type { Request, Response } from "express";
import { runAndRecordSync } from "../../sync/sync-runner.js";
import { getErrorMessage } from "../../utils/error.utils.js";
import { logger } from "../../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../../utils/version.js";
import { setInternalServerErrorResponse, setOkResponse } from "./route.utils.js";

export async function handleSync(_req: Request, res: Response): Promise<void> {
	const { outcome } = await runAndRecordSync("Manual sync");

	if (!outcome.success) {
		const errorMessage = getErrorMessage(outcome.error);
		logger.log({
			message: `${packageJsonName}@${packageJsonVersion} - Error handling sync request: ${errorMessage}`,
			type: "error",
		});
		setInternalServerErrorResponse(res, errorMessage);
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
