import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { search } from "../../search/search.js";
import { respondWithError, setOkResponse } from "../utils/route.utils.js";
import { parseTextAndFilterQuery } from "../utils/text-query.utils.js";

const REQUEST_LABEL = "search";

export async function handleSearch(req: Request, res: Response): Promise<void> {
	const { success: parseSuccess, data: parseData } = parseTextAndFilterQuery(req, res);
	if (!parseSuccess) {
		return;
	}

	const { success, data, error } = await tryCatchAsync(
		async () => await search({ query: parseData.text, apiReference: parseData.apiReference }),
	);

	if (!success) {
		respondWithError({ error, requestLabel: REQUEST_LABEL, res });
		return;
	}

	setOkResponse(res, [...data]);
}
