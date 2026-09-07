import { z } from "zod";

export type ApiReferenceProperty = {
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly modifiers: readonly string[];
	readonly nestedProperties: readonly ApiReferenceProperty[];
};

// Hand-written type + explicit annotation break the self-reference cycle that TS
// Cannot infer; the getter defers evaluation until the const is initialised.
export const apiReferencePropertySchema: z.ZodType<ApiReferenceProperty> = z.compile(
	z
		.object({
			description: z.string(),
			modifiers: z.array(z.string()).readonly(),
			name: z.string(),
			get nestedProperties() {
				return z.array(apiReferencePropertySchema).readonly();
			},
			type: z.string(),
		})
		.readonly(),
);

const apiReferenceCodeSampleSchema = z.compile(
	z
		.object({
			code: z.string(),
			language: z.string(),
		})
		.readonly(),
);

export type ApiReferenceCodeSample = z.infer<typeof apiReferenceCodeSampleSchema>;

const apiReferenceResponseSchema = z.compile(
	z
		.object({
			description: z.string(),
			properties: z.array(apiReferencePropertySchema).readonly(),
			samples: z.array(apiReferenceCodeSampleSchema).readonly(),
			statusCode: z.number(),
		})
		.readonly(),
);

export type ApiReferenceResponse = z.infer<typeof apiReferenceResponseSchema>;

export const apiReferenceEndpointSchema = z.compile(
	z
		.object({
			apiReference: z.string(),
			bodyParameters: z.array(apiReferencePropertySchema).readonly(),
			codename: z.string(),
			endpointParameters: z.array(apiReferencePropertySchema).readonly(),
			endpointUrls: z.array(z.string()).readonly(),
			headerParameters: z.array(apiReferencePropertySchema).readonly(),
			httpMethod: z.string(),
			id: z.string(),
			markdownContent: z.string(),
			queryParameters: z.array(apiReferencePropertySchema).readonly(),
			responses: z.array(apiReferenceResponseSchema).readonly(),
			tags: z.array(z.string()).readonly(),
			title: z.string(),
			url: z.url().optional(),
			usageCodeSamples: z.array(apiReferenceCodeSampleSchema).readonly(),
		})
		.readonly(),
);

export type ApiReferenceEndpoint = z.infer<typeof apiReferenceEndpointSchema>;

export const apiReferenceEndpointsResponseSchema = z.compile(
	z
		.object({
			data: z.object({ apiReferenceEndpoints: z.array(apiReferenceEndpointSchema).readonly() }).readonly(),
		})
		.readonly(),
);
