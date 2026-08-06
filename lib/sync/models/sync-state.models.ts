import { z } from "zod/mini";

export const syncOutcomeSchema = z.readonly(
	z.object({
		apiReferenceEndpointsCount: z.number(),
		apiReferenceObjectsCount: z.number(),
		dbName: z.string(),
		index: z.readonly(
			z.object({
				added: z.number(),
				changed: z.number(),
				removed: z.number(),
				total: z.number(),
				unchanged: z.number(),
			}),
		),
		searchRecordsCount: z.number(),
	}),
);
export type SyncOutcome = z.infer<typeof syncOutcomeSchema>;

export const syncStateSchema = z.readonly(
	z.object({
		durationMs: z.number(),
		endedAt: z.string(),
		error: z.optional(z.string()),
		result: z.optional(syncOutcomeSchema),
		startedAt: z.string(),
		success: z.boolean(),
	}),
);
export type SyncState = z.infer<typeof syncStateSchema>;
