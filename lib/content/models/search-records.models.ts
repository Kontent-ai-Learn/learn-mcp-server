import { z } from "zod/mini";

export const searchRecordTypeSchema = z.literal(["endpoint", "section", "object"]);

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

export const searchRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ searchRecords: z.readonly(z.array(searchRecordSchema)) })),
	}),
);
