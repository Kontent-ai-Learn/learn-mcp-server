import { tryCatchAsync } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import { getEndpointDetails } from "../../content/api-reference-details.js";
import { mapRecordToPublicApiReferenceEndpoint } from "../../content/utils/public-api-reference-endpoint-mapper.js";
import { respondWithError, setOkResponse } from "../utils/route.utils.js";
import { parseTextAndFilterQuery } from "../utils/text-query.utils.js";

const REQUEST_LABEL = "endpoint-details";

export async function handleEndpointDetails(req: Request, res: Response): Promise<void> {
	const { success: parseSuccess, data: parseData } = parseTextAndFilterQuery(req, res);
	if (!parseSuccess) {
		return;
	}

	const { success, data, error } = await tryCatchAsync(
		async () =>
			await getEndpointDetails({
				text: parseData.text,
				apiReference: parseData.apiReference,
				mapRecordToPublicType: mapRecordToPublicApiReferenceEndpoint,
			}),
	);

	if (!success) {
		respondWithError({ error, requestLabel: REQUEST_LABEL, res });
		return;
	}

	setOkResponse(res, data);
}
