import { z } from "zod";
import { sampleDocs } from "./sample-data.js";
import { type SourceDoc, sourceDocsSchema } from "./schema.js";

/**
 * The single boundary for where documentation content comes from. v1 returns
 * the bundled sample data, validated against the schema.
 *
 * TODO: to index real content, replace the body of this function with a fetch
 * of the remote JSON export or a call to the
 * Kontent.ai Delivery API, then `sourceDocsSchema.parse` the result. Nothing
 * else in the pipeline needs to change.
 */
export const loadSourceDocs = async (): Promise<readonly SourceDoc[]> => {
	// Async boundary preserved for the future remote/Delivery-API implementation,
	// which will await a network fetch here.
	const docs = await Promise.resolve(sampleDocs);
	const result = sourceDocsSchema.safeParse(docs);
	if (!result.success) {
		throw new Error(`Invalid source documents:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
};
