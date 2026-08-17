import { env, type FeatureExtractionPipeline, pipeline } from "@huggingface/transformers";
import { z } from "zod/mini";
import { getOrSetFromMemoryCacheAsync } from "../cache/memory-cache.js";
import { EMBEDDING_MODEL, getTransformersCacheDir } from "../config.js";

env.cacheDir = getTransformersCacheDir();

const PIPELINE_CACHE_KEY = "embeddingPipeline";

/** Mean-pooled, L2-normalised 384-dim embeddings — one per input text. */
export async function embedTexts(texts: readonly string[]): Promise<readonly Float32Array[]> {
	if (texts.length === 0) {
		return [];
	}
	const extractor = await getPipeline();
	const output = await extractor([...texts], { normalize: true, pooling: "mean" });
	return (output.tolist() as readonly number[][]).map((row) => Float32Array.from(row));
}

export async function embedQuery(text: string): Promise<Float32Array> {
	const [vector] = await embedTexts([text]);
	if (!vector) {
		throw new Error("Failed to embed query text");
	}
	return vector;
}

/** Loads the embedding model ahead of the first request, so that request doesn't pay for it. */
export async function warmupEmbeddingPipeline(): Promise<void> {
	await getPipeline();
}

async function getPipeline(): Promise<FeatureExtractionPipeline> {
	return await getOrSetFromMemoryCacheAsync({
		key: PIPELINE_CACHE_KEY,
		schema: z.custom<FeatureExtractionPipeline>(),
		value: async () => await pipeline("feature-extraction", EMBEDDING_MODEL),
	});
}
