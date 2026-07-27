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
			message: `Successfully indexed '${index.total}' documents into '${dbName}'.`,
			result: {
				dbName,
				searchRecordsCount,
				apiReferenceEndpointsCount,
				apiReferenceObjectsCount,
				index: {
					added: index.added,
					changed: index.changed,
					removed: index.removed,
					unchanged: index.unchanged,
					total: index.total,
				},
			},
			timestamp: new Date().toISOString(),
			currentVersion: packageJsonVersion,
		});
	});

	if (!success) {
		const errorMessage = getErrorMessage(error);
		logger.log({
			type: "error",
			message: `${packageJsonName}@${packageJsonVersion} - Error handling MCP request: ${errorMessage}`,
		});
		if (!res.headersSent) {
			setInternalServerErrorResponse(res, errorMessage);
		}
	}
}
