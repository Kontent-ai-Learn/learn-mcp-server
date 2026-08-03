import { z } from "zod/mini";

export const searchRecordTypeSchema = z.literal(["endpoint", "section", "object"]);

export type SearchRecordType = z.infer<typeof searchRecordTypeSchema>;

export const searchRecordSchema = z.readonly(
	z.object({
		codename: z.string(),
		id: z.string(),
		markdownContent: z.string(),
		title: z.string(),
		type: searchRecordTypeSchema,
		url: z.url(),
	}),
);

export type SearchRecord = z.infer<typeof searchRecordSchema>;

export const searchRecordsResponseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ searchRecords: z.readonly(z.array(searchRecordSchema)) })),
	}),
);
