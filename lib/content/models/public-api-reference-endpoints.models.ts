import { z } from "zod";
import { apiReferenceCodeSampleSchema, apiReferencePropertySchema, apiReferenceResponseSchema } from "./api-reference-endpoints.models.js";

export const publicApiReferenceEndpointSchema = z.compile(
	z
		.object({
			apiReference: z.string(),
			bodyParameters: z.array(apiReferencePropertySchema).readonly(),
			description: z.string(),
			docsUrl: z.url().optional(),
			endpointParameters: z.array(apiReferencePropertySchema).readonly(),
			endpointUrls: z.array(z.string()).readonly(),
			headerParameters: z.array(apiReferencePropertySchema).readonly(),
			httpMethod: z.string(),
			queryParameters: z.array(apiReferencePropertySchema).readonly(),
			responses: z.array(apiReferenceResponseSchema).readonly(),
			relevanceScore: z.number(),
			tags: z.array(z.string()).readonly(),
			title: z.string(),
			usageCodeSamples: z.array(apiReferenceCodeSampleSchema).readonly(),
		})
		.readonly(),
);

export type PublicApiReferenceEndpoint = z.infer<typeof publicApiReferenceEndpointSchema>;
