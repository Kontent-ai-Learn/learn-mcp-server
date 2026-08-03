import { z } from "zod/mini";
import { apiReferencePropertySchema } from "./api-reference-endpoints.models.js";

export const apiReferenceObjectSchema = z.readonly(
	z.object({
		apiReference: z.string(),
		codename: z.string(),
		id: z.string(),
		markdownContent: z.string(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		title: z.string(),
		url: z.url(),
	}),
);

export type ApiReferenceObject = z.infer<typeof apiReferenceObjectSchema>;

export const apiReferenceObjectsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceObjects: z.readonly(z.array(apiReferenceObjectSchema)) })),
	}),
);
