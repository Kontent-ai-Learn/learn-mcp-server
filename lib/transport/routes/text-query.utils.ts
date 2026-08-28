import type { TryCatchResult } from "@kontent-ai/core-sdk";
import type { Request, Response } from "express";
import * as z from "zod";
import { type ApiReferenceCodenames, apiReferenceCodenames } from "../../config.js";
import { setBadRequestResponse } from "./route.utils.js";

const textQuerySchema = z.object({
	text: z.string().min(1),
	apiReference: z.literal(apiReferenceCodenames).optional(),
});

/**
 * Validates the `?text=` query-string param shared by /search, /endpoint-details, and
 * /object-details. On failure it sends the 400 response itself and returns `undefined`,
 * so callers can bail out with a single early return.
 */
export function parseTextAndFilterQuery(
	req: Request,
	res: Response,
): TryCatchResult<{ readonly text: string; readonly apiReference?: ApiReferenceCodenames }, { readonly errorMessage: string }> {
	const { success, data, error } = textQuerySchema.safeParse(req.query);

	if (success) {
		return {
			success: true,
			data: {
				text: data.text,
				apiReference: data.apiReference,
			},
		};
	}

	setBadRequestResponse(res, `Invalid or missing 'text' query parameter. ${error.message}`);
	return {
		success: false,
		error: { errorMessage: `Invalid or missing 'text' query parameter. ${error.message}` },
	};
}
