import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { search } from "../../search/search.js";
import { logAndRespondError, setOkResponse } from "./route.utils.js";
import { parseTextAndFilterQuery } from "./text-query.utils.js";

export async function handleSearch(req: Request, res: Response): Promise<void> {
	const { success: parseSuccess, data: parseData, error: parseError } = parseTextAndFilterQuery(req, res);
	if (!parseSuccess) {
		logAndRespondError({ error: parseError, requestLabel: "endpoint-details", res });
		return;
	}

	const { success, data, error } = await tryCatchAsync(
		async () => await search({ query: parseData.text, apiReference: parseData.apiReference }),
	);

	if (!success) {
		logAndRespondError({ error, requestLabel: "search", res });
		return;
	}

	setOkResponse(res, [...data]);
}
