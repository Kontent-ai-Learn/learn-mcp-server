import { describe, expect, it } from "vitest";
import { z } from "zod";
import { searchResultSchema } from "../../lib/indexing/indexer.models.js";
import { parseFirstJsonContent, withTestClient } from "./test-client.js";

/** The `documents` key is written literally so renaming the wrapper fails the test loudly. */
const searchContentResultSchema = z.object({
	documents: z.array(searchResultSchema),
});

describe("search-content tool (in-memory e2e)", () => {
	it("is advertised via listTools", async (): Promise<void> => {
		await withTestClient(async (client): Promise<void> => {
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name)).toContain("search-content");
		});
	});

	it("returns relevant documentation from callTool", async (): Promise<void> => {
		await withTestClient(async (client): Promise<void> => {
			// First call builds the index (loads the embedding model + embeds the
			// Sample docs), hence the extended timeout.
			const res = await client.callTool({ arguments: { text: "how do I secure a webhook" }, name: "search-content" });
			expect(res.isError).toBeFalsy();

			const { data: parsedText } = parseFirstJsonContent(res);
			const { documents } = searchContentResultSchema.parse(parsedText);

			expect(documents.length).toBeGreaterThan(0);
			expect(documents.some((d) => /webhook/i.test(d.title) || /webhook/i.test(d.body))).toBe(true);

			// Every result carries its cosine-similarity score, ordered best match first.
			const scores = documents.map((d) => d.score);
			expect(scores).toEqual(scores.toSorted((a, b) => b - a));

			expect(res.structuredContent).toEqual(parsedText);
		});
	}, 120_000);

	it("reports an error result when input violates the Zod schema", async (): Promise<void> => {
		await withTestClient(async (client): Promise<void> => {
			const res = await client.callTool({ arguments: {}, name: "search-content" });
			expect(res.isError).toBe(true);
		});
	});
});
