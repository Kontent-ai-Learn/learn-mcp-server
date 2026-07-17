import { createFetchQuery, getDefaultHttpService, type TryCatchResult, tryCatchAsync } from "@kontent-ai/core-sdk";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import { z } from "zod/mini";
import { getContentUrl } from "../indexing/indexer.config.js";
import { logger } from "../utils/logger.js";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";

export const searchRecordApiReferenceSchema = z.readonly(
	z.object({
		endpointUrl: z.string(),
		endpointName: z.string(),
		endpointMethod: z.string(),
	}),
);

export const searchRecordSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		url: z.url(),
		endpoint: z.optional(searchRecordApiReferenceSchema),
	}),
);

export type SearchRecord = z.infer<typeof searchRecordSchema>;

export type AiApiReferenceProperty = {
	readonly name: string;
	readonly description: string;
	readonly type: string;
	readonly modifiers: readonly string[];
	readonly nestedProperties: readonly AiApiReferenceProperty[];
};

// Hand-written type + explicit annotation break the self-reference cycle that TS
// cannot infer; the getter defers evaluation until the const is initialised.
export const aiApiReferencePropertySchema: z.ZodMiniType<AiApiReferenceProperty> = z.readonly(
	z.object({
		name: z.string(),
		description: z.string(),
		type: z.string(),
		modifiers: z.readonly(z.array(z.string())),
		get nestedProperties() {
			return z.readonly(z.array(aiApiReferencePropertySchema));
		},
	}),
);

export const aiApiReferenceCodeSampleSchema = z.readonly(
	z.object({
		language: z.string(),
		code: z.string(),
	}),
);

export type AiApiReferenceCodeSample = z.infer<typeof aiApiReferenceCodeSampleSchema>;

export const aiApiReferenceResponseSchema = z.readonly(
	z.object({
		statusCode: z.number(),
		description: z.string(),
		properties: z.readonly(z.array(aiApiReferencePropertySchema)),
		samples: z.readonly(z.array(aiApiReferenceCodeSampleSchema)),
	}),
);

export type AiApiReferenceResponse = z.infer<typeof aiApiReferenceResponseSchema>;

export const aiApiReferenceRecordSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		httpMethod: z.string(),
		endpointUrls: z.readonly(z.array(z.string())),
		queryParameters: z.readonly(z.array(aiApiReferencePropertySchema)),
		headerParameters: z.readonly(z.array(aiApiReferencePropertySchema)),
		endpointParameters: z.readonly(z.array(aiApiReferencePropertySchema)),
		bodyParameters: z.readonly(z.array(aiApiReferencePropertySchema)),
		tags: z.readonly(z.array(z.string())),
		usageCodeSamples: z.readonly(z.array(aiApiReferenceCodeSampleSchema)),
		responses: z.readonly(z.array(aiApiReferenceResponseSchema)),
	}),
);

export type AiApiReferenceRecord = z.infer<typeof aiApiReferenceRecordSchema>;

export type LearnRecords = {
	readonly searchRecords: readonly SearchRecord[];
	readonly apiReferenceRecords: readonly AiApiReferenceRecord[];
};

const responseSchema = z.readonly(
	z.object({
		data: z.readonly(
			z.object({
				searchRecords: z.readonly(z.array(searchRecordSchema)),
				apiReferenceRecords: z.readonly(z.array(aiApiReferenceRecordSchema)),
			}),
		),
	}),
);

export const fetchLearnRecords = async (): Promise<TryCatchResult<LearnRecords>> => {
	return await tryCatchAsync(async () => {
		logger.log({ message: "Fetching source documents" });

		const url = getContentUrl();
		if (!url) {
			throw new Error("Invalid source docs url");
		}
		const query = createFetchQuery({
			url,
			config: {
				httpService: getDefaultHttpService(),
				runtimeValidation: { validateResponses: true },
			},
			schema: responseSchema,
			sdkInfo: { name: packageJsonName, version: packageJsonVersion, host: "npmjs.com" },
			mapMetadata: () => ({}),
			mapError: (error) => error,
			mapExtraResponseProps: () => ({}),
		});
		const { payload } = await query.fetch();

		logger.log({
			message: `Loaded ${colorize("yellow", payload.data.searchRecords.length.toString())} search records & ${colorize("yellow", payload.data.apiReferenceRecords.length.toString())} API reference records`,
		});

		return {
			searchRecords: payload.data.searchRecords,
			apiReferenceRecords: payload.data.apiReferenceRecords,
		};
	});
};
