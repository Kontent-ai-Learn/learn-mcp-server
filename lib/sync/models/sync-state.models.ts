import { z } from "zod";

const syncOutcomeSchema = z.compile(
	z
		.object({
			apiReferenceEndpointsCount: z.number(),
			apiReferenceObjectsCount: z.number(),
			dbName: z.string(),
			index: z
				.object({
					added: z.number(),
					changed: z.number(),
					removed: z.number(),
					total: z.number(),
					unchanged: z.number(),
				})
				.readonly(),
			searchRecordsCount: z.number(),
		})
		.readonly(),
);
export type SyncOutcome = z.infer<typeof syncOutcomeSchema>;

export const syncStateSchema = z.compile(
	z
		.object({
			duration: z.string(),
			durationMs: z.number(),
			endedAt: z.string(),
			error: z.string().optional(),
			result: syncOutcomeSchema.optional(),
			startedAt: z.string(),
			success: z.boolean(),
		})
		.readonly(),
);
export type SyncState = z.infer<typeof syncStateSchema>;

export const humanizedSyncStateSchema = z.compile(
	z
		.object({
			duration: z.string(),
			durationMs: z.number(),
			ended: z.string(),
			endedAt: z.string(),
			error: z.string().optional(),
			result: syncOutcomeSchema.optional(),
			started: z.string(),
			startedAt: z.string(),
			success: z.boolean(),
		})
		.readonly(),
);
export type HumanizedSyncState = z.infer<typeof humanizedSyncStateSchema>;
