import { z } from "zod";
import { apiReferencePropertySchema } from "./api-reference-endpoints.models.js";

export const apiReferenceObjectSchema = z.compile(
	z
		.object({
			apiReference: z.string(),
			codename: z.string(),
			id: z.string(),
			markdownContent: z.string(),
			properties: z.array(apiReferencePropertySchema).readonly(),
			title: z.string(),
			url: z.url(),
		})
		.readonly(),
);

export type ApiReferenceObject = z.infer<typeof apiReferenceObjectSchema>;

export const apiReferenceObjectsResponseSchema = z.compile(
	z
		.object({
			data: z.object({ apiReferenceObjects: z.array(apiReferenceObjectSchema).readonly() }).readonly(),
		})
		.readonly(),
);
