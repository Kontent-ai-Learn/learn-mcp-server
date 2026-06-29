import { createFetchQuery, getDefaultHttpService } from "@kontent-ai/core-sdk";
import { NodeHtmlMarkdown } from "node-html-markdown";
import * as z from "zod/mini";
import { packageJsonName, packageJsonVersion } from "../utils/version.js";
import { getContentUrl } from "./config.js";
import type { SourceDoc } from "./schema.js";

const segmentSchema = z.readonly(
	z.object({
		id: z.string(),
		title: z.string(),
		text: z.string(),
		url: z.string(),
	}),
);

const responseSchema = z.readonly(
	z.object({
		data: z.readonly(z.object({ segments: z.readonly(z.array(segmentSchema)) })),
	}),
);

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
	return payload.data.segments.map(mapSegmentToSourceDoc);
};

export const mapSegmentToSourceDoc = (segment: Segment): SourceDoc => ({
	id: segment.id,
	title: segment.title,
	url: segment.url,
	markdown: NodeHtmlMarkdown.translate(segment.text),
});
