import z from "zod";

export const sourceDocSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1),
		url: z.string().min(1),
		markdown: z.string(),
		last_modified: z.iso.datetime().optional(),
	})
	.readonly();

export const sourceDocsSchema = z.array(sourceDocSchema);

export type SourceDoc = z.infer<typeof sourceDocSchema>;
