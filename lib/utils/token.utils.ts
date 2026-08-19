import type { Request } from "express";
import { z } from "zod/mini";
import { LearnMcpExceptionError } from "../exceptions/learn-mcp-exception.js";
import { getEnvConfig } from "./environment.utils.js";

const syncTokenQuerySchema = z.object({
	token: z.string().check(z.minLength(1)),
});

export function validateSyncToken(req: Request): void {
	const { success, data } = syncTokenQuerySchema.safeParse(req.query);
	const expectedToken = getEnvConfig().apiToken;

	if (!success || data.token !== expectedToken) {
		throw new LearnMcpExceptionError("unauthorized", "Invalid or missing 'token' query parameter.");
	}
}
