import { z } from "zod";
import { type SearchRecordType, searchRecordTypeSchema } from "../content/models/search-records.models.js";

export type NormalizedDoc = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly codename: string;
	readonly type: SearchRecordType;
	readonly apiReference: string | null;
};

export type DocChunk = {
	// `${docId}:${chunkIndex}`
	readonly chunkKey: string;
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
};

export const searchResultSchema = z.compile(
	z
		.object({
			body: z.string(),
			codename: z.string(),
			docsUrl: z.url(),
			/** Cosine similarity (0–1) of the document's best-matching chunk. */
			score: z.number(),
			title: z.string(),
			type: searchRecordTypeSchema,
		})
		.readonly(),
);

export type SearchResult = z.infer<typeof searchResultSchema>;
