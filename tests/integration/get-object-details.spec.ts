import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicApiReferenceObjectSchema } from "../../lib/content/models/public-api-reference-objects.models.js";
import { callToolAndParse, parseFirstJsonContent, type ToolCallResult, withTestClient } from "./test-client.js";

/** The `candidates` key is written literally so renaming the wrapper fails the test loudly. */
const getObjectDetailsResultSchema = z.object({
	candidates: z.array(publicApiReferenceObjectSchema),
});

const callGetObjectDetails = async (
	text: string,
	apiReference?: string,
): Promise<ToolCallResult<z.infer<typeof getObjectDetailsResultSchema>>> =>
	await callToolAndParse({ apiReference, schema: getObjectDetailsResultSchema, text, toolName: "get-object-details" });

describe("get-object-details tool (in-memory e2e)", () => {
	// Unfiltered, the two error-object variants are near-identical text, so which one ranks first is
	// a tie-break rather than a behaviour worth pinning. Assert the object, not the winning API.
	it("returns the object matching a description", async () => {
		const result = await callGetObjectDetails("What fields does the error object contain?");
		expect(result.record?.candidates?.[0]?.docsUrl).toMatch(/\/learn\/docs\/apis\/[a-z0-9-]+\/errors#error-object$/);
	});

	it("returns the object matching its name", async () => {
		const result = await callGetObjectDetails("object representing a language");
		expect(result.record?.candidates?.[0]?.docsUrl).toBe(
			"http://localhost:3000/learn/docs/apis/delivery-api/languages#language-object",
		);
	});

	it("mirrors structuredContent in the text content block", async () => {
		await withTestClient(async (client) => {
			const res = await client.callTool({
				arguments: { text: "What fields does the error object contain?" },
				name: "get-object-details",
			});
			const { data: parsedText } = parseFirstJsonContent(res);

			expect(res.structuredContent).toEqual(parsedText);
		});
	});
});

describe("get-object-details shared codenames (in-memory e2e)", () => {
	/**
	 * One schema object is reused by two APIs. Both variants must be indexed, reachable by their own
	 * filter, and carry that API's url — the whole point of the root-qualified document id.
	 */
	it.each([
		["delivery_api", "http://localhost:3000/learn/docs/apis/delivery-api/errors#error-object"],
		["sync_api_v2", "http://localhost:3000/learn/docs/apis/sync-api-v2/errors#error-object"],
	])("returns the %s variant of a schema object shared by several APIs", async (apiReference, expectedUrl) => {
		const result = await callGetObjectDetails("What fields does the error object contain?", apiReference);

		expect(result.record?.candidates?.length).toBeGreaterThan(0);
		expect(result.record?.candidates?.[0]?.apiReference).toBe(apiReference);
		expect(result.record?.candidates?.[0]?.docsUrl).toBe(expectedUrl);
	});

	/**
	 * A codename can name several records, so the join returns them all and leaves the choice to the
	 * caller. Before that change this query yielded a single candidate.
	 */
	it("returns every variant of a shared codename when no API is specified", async () => {
		const result = await callGetObjectDetails("What fields does the error object contain?");
		const errorObjects = (result.record?.candidates ?? []).filter((candidate) => candidate.docsUrl.endsWith("/errors#error-object"));

		expect(errorObjects.map((candidate) => candidate.apiReference).toSorted()).toEqual(["delivery_api", "sync_api_v2"]);
	});
});
