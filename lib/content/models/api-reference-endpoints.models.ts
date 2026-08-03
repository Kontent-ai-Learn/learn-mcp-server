import { z } from "zod/mini";

export type ApiReferenceProperty = {
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly modifiers: readonly string[];
	readonly nestedProperties: readonly ApiReferenceProperty[];
};

// Hand-written type + explicit annotation break the self-reference cycle that TS
// Cannot infer; the getter defers evaluation until the const is initialised.
export const apiReferencePropertySchema: z.ZodMiniType<ApiReferenceProperty> = z.readonly(
	z.object({
		description: z.string(),
		modifiers: z.readonly(z.array(z.string())),
		name: z.string(),
		get nestedProperties() {
			return z.readonly(z.array(apiReferencePropertySchema));
		},
		type: z.string(),
	}),
);

export const apiReferenceCodeSampleSchema = z.readonly(
	z.object({
		code: z.string(),
		language: z.string(),
	}),
);

export type ApiReferenceCodeSample = z.infer<typeof apiReferenceCodeSampleSchema>;

export const apiReferenceResponseSchema = z.readonly(
	z.object({
		description: z.string(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		samples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
		statusCode: z.number(),
	}),
);

export type ApiReferenceResponse = z.infer<typeof apiReferenceResponseSchema>;

export const apiReferenceEndpointSchema = z.readonly(
	z.object({
		bodyParameters: z.readonly(z.array(apiReferencePropertySchema)),
		codename: z.string(),
		endpointParameters: z.readonly(z.array(apiReferencePropertySchema)),
		endpointUrls: z.readonly(z.array(z.string())),
		headerParameters: z.readonly(z.array(apiReferencePropertySchema)),
		httpMethod: z.string(),
		id: z.string(),
		markdownContent: z.string(),
		queryParameters: z.readonly(z.array(apiReferencePropertySchema)),
		responses: z.readonly(z.array(apiReferenceResponseSchema)),
		tags: z.readonly(z.array(z.string())),
		title: z.string(),
		url: z.optional(z.url()),
		usageCodeSamples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
	}),
);

export type ApiReferenceEndpoint = z.infer<typeof apiReferenceEndpointSchema>;

export const apiReferenceEndpointsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceEndpoints: z.readonly(z.array(apiReferenceEndpointSchema)) })),
	}),
);
