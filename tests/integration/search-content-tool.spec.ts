import { describe, expect, it } from "vitest";
import { withTestClient } from "./test-client.js";

describe("search-content tool (in-memory e2e)", () => {
	it("is advertised via listTools", async () =>
		withTestClient(async (client) => {
			const { tools } = await client.listTools();
			expect(tools.map((t) => t.name)).toContain("search-content");
		}));

	it("returns the expected text from callTool", async () =>
		withTestClient(async (client) => {
			const res = await client.callTool({ name: "search-content", arguments: { text: "hello" } });
			expect(res.isError).toBeFalsy();
			expect(res.content).toEqual([{ type: "text", text: "Smurfer! - hello" }]);
		}));

	it("reports an error result when input violates the Zod schema", async () =>
		withTestClient(async (client) => {
			const res = await client.callTool({ name: "search-content", arguments: {} });
			expect(res.isError).toBe(true);
		}));
});
