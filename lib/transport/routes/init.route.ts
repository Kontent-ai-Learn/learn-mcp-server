import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { initializeAll } from "../../initialization/initialization.js";
import { getErrorMessage } from "../../utils/error.utils.js";
import { logger } from "../../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../../utils/version.js";
import { setInternalServerErrorResponse, setOkResponse } from "./route.utils.js";

export async function handleInit(_req: Request, res: Response): Promise<void> {
	const { success, error } = await tryCatchAsync(async () => {
		const { dbName, searchRecordsCount, apiReferenceEndpointsCount, apiReferenceObjectsCount, index } = await initializeAll();

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
	});

	if (!success) {
		const errorMessage = getErrorMessage(error);
		logger.log({
			message: `${packageJsonName}@${packageJsonVersion} - Error handling MCP request: ${errorMessage}`,
			type: "error",
		});
		if (!res.headersSent) {
			setInternalServerErrorResponse(res, errorMessage);
		}
	}
}
