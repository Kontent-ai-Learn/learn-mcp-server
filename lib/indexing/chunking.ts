import { match } from "ts-pattern";
import { CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } from "../config.js";
import type { DocChunk, NormalizedDoc } from "./indexer.models.js";

interface PackState {
	readonly done: readonly string[];
	readonly current: string;
}

interface ChunkOptions {
	readonly targetChars: number;
	readonly overlapChars: number;
}

const defaultOptions: ChunkOptions = {
	overlapChars: CHUNK_OVERLAP_CHARS,
	targetChars: CHUNK_TARGET_CHARS,
};

export function chunkPlainText(text: string, options: ChunkOptions = defaultOptions): readonly string[] {
	const { targetChars, overlapChars } = options;
	const units = splitParagraphs(text).flatMap((paragraph) =>
		paragraph.length > targetChars ? splitOversized(paragraph, targetChars) : [paragraph],
	);

	const packed = units.reduce<PackState>(
		({ done, current }, unit) =>
			match({ fits: current.length + 2 + unit.length <= targetChars, hasCurrent: current.length > 0 })
				.with({ hasCurrent: false }, () => ({ current: unit, done }))
				.with({ fits: true }, () => ({ current: `${current}\n\n${unit}`, done }))
				.otherwise(() => ({
					current: seedNext(current, unit, overlapChars),
					done: [...done, current],
				})),
		{ current: "", done: [] },
	);

	return packed.current.length > 0 ? [...packed.done, packed.current] : packed.done;
}

export function chunkDoc(doc: NormalizedDoc, options: ChunkOptions = defaultOptions): readonly DocChunk[] {
	return chunkPlainText(doc.body, options).map((text, chunkIndex) => ({
		chunkIndex,
		chunkKey: `${doc.id}:${chunkIndex}`,
		docId: doc.id,
		text,
	}));
}

function splitParagraphs(text: string): readonly string[] {
	return text
		.replaceAll("\r\n", "\n")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);
}

/** Hard-split a single oversized paragraph on word boundaries. */
function splitOversized(paragraph: string, targetChars: number): readonly string[] {
	const pieces = paragraph
		.split(/\s+/)
		.reduce<{ readonly done: readonly string[]; readonly current: string }>(
			({ done, current }, word) =>
				current.length > 0 && current.length + 1 + word.length > targetChars
					? { current: word, done: [...done, current] }
					: { current: current.length > 0 ? `${current} ${word}` : word, done },
			{ current: "", done: [] },
		);
	return pieces.current.length > 0 ? [...pieces.done, pieces.current] : pieces.done;
}

/** Trailing slice of the previous chunk, trimmed to a word boundary, for overlap. */
function overlapTail(chunk: string, overlapChars: number): string {
	if (overlapChars <= 0) {
		return "";
	}
	if (chunk.length <= overlapChars) {
		return chunk;
	}
	const tail = chunk.slice(chunk.length - overlapChars);
	const boundary = tail.indexOf(" ");
	return boundary === -1 ? tail : tail.slice(boundary + 1);
}

/** Seed the next chunk with overlap from the previous one, if any. */
function seedNext(previous: string, unit: string, overlapChars: number): string {
	const tail = overlapTail(previous, overlapChars);
	return tail.length > 0 ? `${tail}\n\n${unit}` : unit;
}
