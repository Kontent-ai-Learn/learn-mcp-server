import z from "zod";

export const searchRecordShema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1),
		url: z.string().min(1),
		markdown: z.string(),
		last_modified: z.iso.datetime().optional(),
	})
	.readonly();

export const searchRecordsSchema = z.array(searchRecordShema);

export type SearchRecord = z.infer<typeof searchRecordShema>;
