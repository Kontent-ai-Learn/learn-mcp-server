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

export const chunkSourceFieldSchema = z.compile(z.literal(["title", "body"]));

/** Which field of the source document a chunk's text was drawn from — `documents.title` or `documents.body`. */
export type ChunkSourceField = z.infer<typeof chunkSourceFieldSchema>;

export type DocChunk = {
	// `${docId}:${chunkIndex}`, or `${docId}:title` for the title chunk
	readonly chunkKey: string;
	readonly docId: string;
	readonly chunkIndex: number;
	readonly sourceField: ChunkSourceField;
	readonly text: string;
};

export const searchResultSchema = z.compile(
	z
		.object({
			body: z.string(),
			codename: z.string(),
			docsUrl: z.url(),
			/** Blended relevance (0–1): title similarity and best body-chunk similarity, weighted by `TITLE_SCORE_WEIGHT`/`BODY_SCORE_WEIGHT`. */
			score: z.number(),
			title: z.string(),
			type: searchRecordTypeSchema,
		})
		.readonly(),
);

export type SearchResult = z.infer<typeof searchResultSchema>;
