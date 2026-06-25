import { match } from "ts-pattern";
import { CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } from "./constants.js";
import type { DocChunk, NormalizedDoc } from "./schema.js";

export type ChunkOptions = {
	readonly targetChars: number;
	readonly overlapChars: number;
};

const defaultOptions: ChunkOptions = {
	targetChars: CHUNK_TARGET_CHARS,
	overlapChars: CHUNK_OVERLAP_CHARS,
};

const splitParagraphs = (text: string): readonly string[] =>
	text
		.replace(/\r\n/g, "\n")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);

/** Hard-split a single oversized paragraph on word boundaries. */
const splitOversized = (paragraph: string, targetChars: number): readonly string[] => {
	const pieces = paragraph
		.split(/\s+/)
		.reduce<{ readonly done: readonly string[]; readonly current: string }>(
			({ done, current }, word) =>
				current.length > 0 && current.length + 1 + word.length > targetChars
					? { done: [...done, current], current: word }
					: { done, current: current.length > 0 ? `${current} ${word}` : word },
			{ done: [], current: "" },
		);
	return pieces.current.length > 0 ? [...pieces.done, pieces.current] : pieces.done;
};

/** Trailing slice of the previous chunk, trimmed to a word boundary, for overlap. */
const overlapTail = (chunk: string, overlapChars: number): string => {
	if (overlapChars <= 0) {
		return "";
	}
	if (chunk.length <= overlapChars) {
		return chunk;
	}
	const tail = chunk.slice(chunk.length - overlapChars);
	const boundary = tail.indexOf(" ");
	return boundary === -1 ? tail : tail.slice(boundary + 1);
};

/** Seed the next chunk with overlap from the previous one, if any. */
const seedNext = (previous: string, unit: string, overlapChars: number): string => {
	const tail = overlapTail(previous, overlapChars);
	return tail.length > 0 ? `${tail}\n\n${unit}` : unit;
};

type PackState = {
	readonly done: readonly string[];
	readonly current: string;
};

/**
 * Split plain text into overlapping, paragraph-aligned chunks of roughly
 * `targetChars`. Pure: no I/O, deterministic.
 */
export const chunkPlainText = (text: string, options: ChunkOptions = defaultOptions): readonly string[] => {
	const { targetChars, overlapChars } = options;
	const units = splitParagraphs(text).flatMap((paragraph) =>
		paragraph.length > targetChars ? splitOversized(paragraph, targetChars) : [paragraph],
	);

	const packed = units.reduce<PackState>(
		({ done, current }, unit) =>
			match({ hasCurrent: current.length > 0, fits: current.length + 2 + unit.length <= targetChars })
				.with({ hasCurrent: false }, () => ({ done, current: unit }))
				.with({ fits: true }, () => ({ done, current: `${current}\n\n${unit}` }))
				.otherwise(() => ({
					done: [...done, current],
					current: seedNext(current, unit, overlapChars),
				})),
		{ done: [], current: "" },
	);

	return packed.current.length > 0 ? [...packed.done, packed.current] : packed.done;
};

/** Chunk a normalised document into keyed `DocChunk`s. */
export const chunkDoc = (doc: NormalizedDoc, options: ChunkOptions = defaultOptions): readonly DocChunk[] =>
	chunkPlainText(doc.body, options).map((text, chunkIndex) => ({
		chunkKey: `${doc.id}:${chunkIndex}`,
		docId: doc.id,
		chunkIndex,
		text,
	}));
