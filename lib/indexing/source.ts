import { NodeHtmlMarkdown } from "node-html-markdown";
import { z } from "zod";
import { getContentUrl } from "./config.js";
import { sampleDocs } from "./sample-data.js";
import { type SourceDoc, sourceDocsSchema } from "./schema.js";

const segmentSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		text: z.string(),
		url: z.string(),
	})
	.readonly();

const responseSchema = z.object({ data: z.object({ segments: z.array(segmentSchema).readonly() }).readonly() }).readonly();

type Segment = z.infer<typeof segmentSchema>;

/**
 * Loads the documents to index. Fetches the live content endpoint when `CONTENT_URL`
 * is set; otherwise falls back to the bundled sample data (tests / local dev).
 */
export const loadSourceDocs = async (): Promise<readonly SourceDoc[]> => {
	const url = getContentUrl();
	// Empty (tests set CONTENT_URL="") or unset → fall back to the bundled sample data.
	if (!url) {
		return sourceDocsSchema.parse(sampleDocs);
	}
	const {
		data: { segments },
	} = await fetchSegments(url);
	return segments.map(toSourceDoc);
};

/** Maps a content segment to a source document, converting its HTML body to Markdown. */
export const toSourceDoc = (segment: Segment): SourceDoc => ({
	id: segment.id,
	title: segment.title,
	url: segment.url,
	body: NodeHtmlMarkdown.translate(segment.text),
});

async function fetchSegments(url: string): Promise<z.infer<typeof responseSchema>> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch content from ${url}: ${response.status} ${response.statusText}`);
	}
	return responseSchema.parse(await response.json());
}
