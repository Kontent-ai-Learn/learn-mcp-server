import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { getObjectDetails } from "../../content/api-reference-details.js";
import { logAndRespondError, setOkResponse } from "./route.utils.js";
import { parseTextQuery } from "./text-query.utils.js";

export async function handleObjectDetails(req: Request, res: Response): Promise<void> {
	const text = parseTextQuery(req, res);
	if (text === undefined) {
		return;
	}

	const { success, data, error } = await tryCatchAsync(async () => await getObjectDetails(text));

	if (!success) {
		logAndRespondError({ error, requestLabel: "object-details", res });
		return;
	}

	setOkResponse(res, data);
}
