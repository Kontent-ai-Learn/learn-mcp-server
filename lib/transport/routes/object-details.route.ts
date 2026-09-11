import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { getObjectDetails } from "../../content/api-reference-details.js";
import { mapRecordToPublicApiReferenceObject } from "../../content/utils/public-api-reference-object-mapper.js";
import { respondWithError, setOkResponse } from "../utils/route.utils.js";
import { parseTextAndFilterQuery } from "../utils/text-query.utils.js";

const REQUEST_LABEL = "object-details";

export async function handleObjectDetails(req: Request, res: Response): Promise<void> {
	const { success: parseSuccess, data: parseData } = parseTextAndFilterQuery(req, res);
	if (!parseSuccess) {
		return;
	}

	const { success, data, error } = await tryCatchAsync(
		async () =>
			await getObjectDetails({
				text: parseData.text,
				apiReference: parseData.apiReference,
				mapRecordToPublicType: mapRecordToPublicApiReferenceObject,
			}),
	);

	if (!success) {
		respondWithError({ error, requestLabel: REQUEST_LABEL, res });
		return;
	}

	setOkResponse(res, data);
}
