import { createFetchQuery, getDefaultHttpService } from "@kontent-ai/core-sdk";
import { NodeHtmlMarkdown } from "node-html-markdown";
import * as z from "zod/mini";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";
import { getContentUrl } from "./config.js";
import type { SourceDoc } from "./schema.js";

const segmentSchema = z.object({
	id: z.string(),
	title: z.string(),
	text: z.string(),
	url: z.string(),
});

const responseSchema = z.object({ data: z.object({ segments: z.array(segmentSchema) }) });

type Segment = z.infer<typeof segmentSchema>;

export const loadSourceDocs = async (): Promise<readonly SourceDoc[]> => {
	const url = getContentUrl();
	if (!url) {
		throw new Error("Invalid source docs url");
	}
	const query = createFetchQuery({
		url,
		config: {
			httpService: getDefaultHttpService(),
			runtimeValidation: { validateResponses: true },
		},
		schema: responseSchema,
		sdkInfo: { name: packageJsonName, version: packageJsonVersion, host: "npmjs.com" },
		mapMetadata: () => ({}),
		mapError: (error) => error,
		mapExtraResponseProps: () => ({}),
	});
	const { payload } = await query.fetch();
	return payload.data.segments.map(toSourceDoc);
};

/** Maps a content segment to a source document, converting its HTML body to Markdown. */
export const toSourceDoc = (segment: Segment): SourceDoc => ({
	id: segment.id,
	title: segment.title,
	url: segment.url,
	body: NodeHtmlMarkdown.translate(segment.text),
});
