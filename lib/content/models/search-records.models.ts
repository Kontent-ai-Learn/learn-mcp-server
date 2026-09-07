import { z } from "zod";

export const searchRecordTypeSchema = z.compile(z.literal(["endpoint", "section", "object"]));

export type SearchRecordType = z.infer<typeof searchRecordTypeSchema>;

export const searchRecordSchema = z.compile(
	z
		.object({
			codename: z.string(),
			id: z.string(),
			markdownContent: z.string(),
			title: z.string(),
			type: searchRecordTypeSchema,
			url: z.url(),
		})
		.readonly(),
);

export type SearchRecord = z.infer<typeof searchRecordSchema>;

export const searchRecordsResponseSchema = z.compile(
	z
		.object({
			data: z.object({ searchRecords: z.array(searchRecordSchema).readonly() }).readonly(),
		})
		.readonly(),
);
