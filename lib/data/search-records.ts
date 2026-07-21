import { type TryCatchResult, tryCatchAsync } from "@kontent-ai/core-sdk";
import { colorize } from "@kontent-ai/core-sdk/devkit";
import { z } from "zod/mini";
import { getSearchRecordsUrl } from "../indexing/indexer.config.js";
import { logger } from "../utils/logger.js";
import { fetchFromEndpoint } from "./learn-api.js";

export const searchRecordTypeSchema = z.literal(["endpoint", "section"]);

export type SearchRecordType = z.infer<typeof searchRecordTypeSchema>;

export const searchRecordSchema = z.readonly(
	z.object({
		id: z.string(),
		codename: z.string(),
		title: z.string(),
		markdownContent: z.string(),
		url: z.url(),
		type: searchRecordTypeSchema,
	}),
);

export type SearchRecord = z.infer<typeof searchRecordSchema>;

const searchRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ searchRecords: z.readonly(z.array(searchRecordSchema)) })),
	}),
);

export async function fetchSearchRecords(): Promise<TryCatchResult<readonly SearchRecord[]>> {
	return await tryCatchAsync(async () => {
		logger.log({ message: "Fetching search records" });

		const records = await fetchFromEndpoint(
			getSearchRecordsUrl(),
			searchRecordsResponseSchema,
			(payload) => payload.data.searchRecords,
		);

		logger.log({ message: `Loaded ${colorize("yellow", records.length.toString())} search records` });

		return records;
	});
}
