import { z } from "zod";
import { apiReferencePropertySchema } from "./api-reference-endpoints.models.js";

export const publicApiReferenceObjectSchema = z.compile(
	z
		.object({
			apiReference: z.string(),
			description: z.string(),
			docsUrl: z.url().optional(),
			properties: z.array(apiReferencePropertySchema).readonly(),
			relevanceScore: z.number(),
		})
		.readonly(),
);

export type PublicApiReferenceObject = z.infer<typeof publicApiReferenceObjectSchema>;
