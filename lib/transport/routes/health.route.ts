import type { Request, Response } from "express";
import { packageJsonVersion } from "../../utils/version.js";
import { setOkResponse } from "./route.utils.js";

export function handleHealth(_req: Request, res: Response): void {
	setOkResponse(res, {
		status: "ok",
		timestamp: new Date().toISOString(),
		currentVersion: packageJsonVersion,
	});
}
