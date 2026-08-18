import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { search } from "../../search/search.js";
import { logAndRespondError, setOkResponse } from "./route.utils.js";
import { parseTextQuery } from "./text-query.utils.js";

export async function handleSearch(req: Request, res: Response): Promise<void> {
	const text = parseTextQuery(req, res);
	if (text === undefined) {
		return;
	}

	const { success, data, error } = await tryCatchAsync(async () => await search(text));

	if (!success) {
		logAndRespondError({ error, requestLabel: "search", res });
		return;
	}

	setOkResponse(res, [...data]);
}
