import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../lib/indexing/indexer.models.js";
import { withTestClient } from "./test-client.js";

interface TextContent {
	readonly type: string;
	readonly text: string;
}

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

			const content = res.content as readonly TextContent[];
			const [first] = content;

			expect(first?.type).toBe("text");

			const results = JSON.parse(first?.text ?? "[]") as readonly SearchResult[];
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => /webhook/i.test(r.title) || /webhook/i.test(r.body))).toBe(true);

			// Every result carries its cosine-similarity score.
			for (const result of results) {
				expect(typeof result.score).toBe("number");
			}
		});
	}, 120_000);

	it("reports an error result when input violates the Zod schema", async (): Promise<void> => {
		await withTestClient(async (client): Promise<void> => {
			const res = await client.callTool({ arguments: {}, name: "search-content" });
			expect(res.isError).toBe(true);
		});
	});
});
