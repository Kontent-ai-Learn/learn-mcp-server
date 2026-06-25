import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../lib/indexing/schema.js";
import { withTestClient } from "./test-client.js";

type TextContent = { readonly type: string; readonly text: string };

describe("search-content tool (in-memory e2e)", () => {
	it("is advertised via listTools", async () =>
		withTestClient(async (client) => {
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name)).toContain("search-content");
		}));

	it(
		"returns relevant documentation from callTool",
		async () =>
			withTestClient(async (client) => {
				// First call builds the index (loads the embedding model + embeds the
				// sample docs), hence the extended timeout.
				const res = await client.callTool({ name: "search-content", arguments: { text: "how do I secure a webhook" } });
				expect(res.isError).toBeFalsy();

				const content = res.content as readonly TextContent[];
				const [first] = content;
				expect(first?.type).toBe("text");

				const results = JSON.parse(first?.text ?? "[]") as readonly SearchResult[];
				expect(results.length).toBeGreaterThan(0);
				expect(results.some((r) => /webhook/i.test(r.title) || /webhook/i.test(r.body))).toBe(true);

				// Every result is annotated with how it matched and its scores.
				for (const result of results) {
					expect(["vector", "lexical", "hybrid"]).toContain(result.matchType);
					expect(typeof result.score).toBe("number");
					expect(result.scores).toHaveProperty("vector");
					expect(result.scores).toHaveProperty("lexical");
				}
				// A query sharing exact terms with a doc ("webhook") should hybrid-match.
				expect(results.some((r) => r.matchType === "hybrid")).toBe(true);
			}),
		120_000,
	);

	it("reports an error result when input violates the Zod schema", async () =>
		withTestClient(async (client) => {
			const res = await client.callTool({ name: "search-content", arguments: {} });
			expect(res.isError).toBe(true);
		}));
});
