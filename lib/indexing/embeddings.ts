import { env, type FeatureExtractionPipeline, pipeline } from "@huggingface/transformers";
import { EMBEDDING_MODEL, getCacheDir } from "./indexer.config.js";

env.cacheDir = getCacheDir();

/**
 * Lazily-initialised pipeline singleton. The pipeline is an expensive, stateful
 * resource (loads model weights once) — genuinely unavoidable shared mutable
 * state, held on a const object to avoid a top-level `let`.
 */
const state: { pipeline: Promise<FeatureExtractionPipeline> | null } = { pipeline: null };

/** Mean-pooled, L2-normalised 384-dim embeddings — one per input text. */
export async function embedTexts(texts: readonly string[]): Promise<readonly Float32Array[]> {
	if (texts.length === 0) {
		return [];
	}
	const extractor = await getPipeline();
	const output = await extractor([...texts], { pooling: "mean", normalize: true });
	return (output.tolist() as readonly number[][]).map((row) => Float32Array.from(row));
}

export async function embedQuery(text: string): Promise<Float32Array> {
	const [vector] = await embedTexts([text]);
	if (!vector) {
		throw new Error("Failed to embed query text");
	}
	return vector;
}

async function getPipeline(): Promise<FeatureExtractionPipeline> {
	state.pipeline ??= pipeline("feature-extraction", EMBEDDING_MODEL);
	return await state.pipeline;
}
