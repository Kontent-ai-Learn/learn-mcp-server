import { z } from "zod/mini";

export type ApiReferenceProperty = {
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly modifiers: readonly string[];
	readonly nestedProperties: readonly ApiReferenceProperty[];
};

// Hand-written type + explicit annotation break the self-reference cycle that TS
// cannot infer; the getter defers evaluation until the const is initialised.
export const apiReferencePropertySchema: z.ZodMiniType<ApiReferenceProperty> = z.readonly(
	z.object({
		name: z.string(),
		description: z.string(),
		type: z.string(),
		modifiers: z.readonly(z.array(z.string())),
		get nestedProperties() {
			return z.readonly(z.array(apiReferencePropertySchema));
		},
	}),
);

export const apiReferenceCodeSampleSchema = z.readonly(
	z.object({
		language: z.string(),
		code: z.string(),
	}),
);

export type ApiReferenceCodeSample = z.infer<typeof apiReferenceCodeSampleSchema>;

export const apiReferenceResponseSchema = z.readonly(
	z.object({
		statusCode: z.number(),
		description: z.string(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		samples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
	}),
);

export type ApiReferenceResponse = z.infer<typeof apiReferenceResponseSchema>;

export const apiReferenceEndpointSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		httpMethod: z.string(),
		url: z.optional(z.url()),
		endpointUrls: z.readonly(z.array(z.string())),
		queryParameters: z.readonly(z.array(apiReferencePropertySchema)),
		headerParameters: z.readonly(z.array(apiReferencePropertySchema)),
		endpointParameters: z.readonly(z.array(apiReferencePropertySchema)),
		bodyParameters: z.readonly(z.array(apiReferencePropertySchema)),
		tags: z.readonly(z.array(z.string())),
		usageCodeSamples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
		responses: z.readonly(z.array(apiReferenceResponseSchema)),
	}),
);

export type ApiReferenceEndpoint = z.infer<typeof apiReferenceEndpointSchema>;

export const apiReferenceEndpointsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceEndpoints: z.readonly(z.array(apiReferenceEndpointSchema)) })),
	}),
);
