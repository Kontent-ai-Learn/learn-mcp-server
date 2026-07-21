import { type TryCatchResult, tryCatchAsync } from "@kontent-ai/core-sdk";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import { z } from "zod/mini";
import { getApiReferenceRecordsUrl } from "../indexing/indexer.config.js";
import { logger } from "../utils/logger.js";
import { fetchFromEndpoint } from "./learn-api.js";

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

export const aiApiReferenceResponseSchema = z.readonly(
	z.object({
		statusCode: z.number(),
		description: z.string(),
		properties: z.readonly(z.array(apiReferencePropertySchema)),
		samples: z.readonly(z.array(apiReferenceCodeSampleSchema)),
	}),
);

export type ApiReferenceResponse = z.infer<typeof aiApiReferenceResponseSchema>;

export const apiReferenceRecordSchema = z.readonly(
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
		responses: z.readonly(z.array(aiApiReferenceResponseSchema)),
	}),
);

export type AiApiReferenceRecord = z.infer<typeof apiReferenceRecordSchema>;

const apiReferenceRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ apiReferenceRecords: z.readonly(z.array(apiReferenceRecordSchema)) })),
	}),
);

export async function fetchApiReferenceRecords(): Promise<TryCatchResult<readonly AiApiReferenceRecord[]>> {
	return await tryCatchAsync(async () => {
		logger.log({ message: "Fetching API reference records" });

		const records = await fetchFromEndpoint(
			getApiReferenceRecordsUrl(),
			apiReferenceRecordsResponseSchema,
			(payload) => payload.data.apiReferenceRecords,
		);

		logger.log({ message: `Loaded ${colorize("yellow", records.length.toString())} API reference records` });

		return records;
	});
}
