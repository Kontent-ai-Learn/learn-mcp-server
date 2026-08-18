import type { Request, Response } from "express";
import { z } from "zod/mini";
import { setBadRequestResponse } from "./route.utils.js";

const textQuerySchema = z.object({
	text: z.string().check(z.minLength(1)),
});

/**
 * Validates the `?text=` query-string param shared by /search, /endpoint-details, and
 * /object-details. On failure it sends the 400 response itself and returns `undefined`,
 * so callers can bail out with a single early return.
 */
export function parseTextQuery(req: Request, res: Response): string | undefined {
	const { success, data, error } = textQuerySchema.safeParse(req.query);

	if (success) {
		return data.text;
	}

	setBadRequestResponse(res, `Invalid or missing 'text' query parameter. ${error.message}`);
	return undefined;
}
