import { z } from "zod/mini";
import { apiReferencePropertySchema } from "./api-reference-endpoints.models.js";

export const apiReferenceObjectSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		url: z.url(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		apiReference: z.string(),
	}),
);

export type ApiReferenceObject = z.infer<typeof apiReferenceObjectSchema>;

export const apiReferenceObjectsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceObjects: z.readonly(z.array(apiReferenceObjectSchema)) })),
	}),
);
