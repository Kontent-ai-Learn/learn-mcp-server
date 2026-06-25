import { describe, expect, it } from "vitest";
import { chunkDoc, chunkPlainText } from "../../lib/indexing/chunking.js";
import type { NormalizedDoc } from "../../lib/indexing/schema.js";

const repeat = (word: string, times: number): string => Array.from({ length: times }, () => word).join(" ");

describe("chunkPlainText", () => {
	it("returns a single chunk for short text", () => {
		const chunks = chunkPlainText("A short paragraph of text.");
		expect(chunks).toEqual(["A short paragraph of text."]);
	});

	it("returns no chunks for empty/whitespace input", () => {
		expect(chunkPlainText("   \n\n  ")).toEqual([]);
	});

	it("packs multiple paragraphs into one chunk while under the target size", () => {
		const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
		const chunks = chunkPlainText(text, { targetChars: 1000, overlapChars: 0 });
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toContain("First paragraph.");
		expect(chunks[0]).toContain("Third paragraph.");
	});

	it("splits into multiple chunks when paragraphs exceed the target size", () => {
		const para = (n: number) => `Paragraph ${n} ${repeat("word", 30)}`;
		const text = [para(1), para(2), para(3)].join("\n\n");
		const chunks = chunkPlainText(text, { targetChars: 200, overlapChars: 0 });
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(260); // target + a partial trailing unit
		}
	});

	it("hard-splits a single oversized paragraph on word boundaries", () => {
		const chunks = chunkPlainText(repeat("alpha", 100), { targetChars: 120, overlapChars: 0 });
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(120);
			expect(chunk).not.toMatch(/^\s|\s$/); // trimmed at boundaries
		}
	});

	it("carries overlap from the previous chunk into the next", () => {
		const text = `${repeat("intro", 40)}\n\n${repeat("tail", 40)}`;
		const [first, second] = chunkPlainText(text, { targetChars: 220, overlapChars: 40 });
		expect(first).toBeDefined();
		expect(second).toBeDefined();
		// The start of a later chunk should share text with the end of the previous one.
		const lastWordOfFirst = (first ?? "").trim().split(" ").at(-1) ?? "";
		expect(second).toContain(lastWordOfFirst);
	});
});

describe("chunkDoc", () => {
	const doc: NormalizedDoc = {
		id: "doc-1",
		title: "Title",
		url: "https://example.com/doc-1",
		body: "First paragraph.\n\nSecond paragraph.",
		contentHash: "hash",
		lastModified: null,
	};

	it("assigns sequential keys and indices", () => {
		const chunks = chunkDoc(doc, { targetChars: 20, overlapChars: 0 });
		expect(chunks.length).toBeGreaterThan(1);
		chunks.forEach((chunk, index) => {
			expect(chunk.docId).toBe("doc-1");
			expect(chunk.chunkIndex).toBe(index);
			expect(chunk.chunkKey).toBe(`doc-1:${index}`);
		});
	});
});
