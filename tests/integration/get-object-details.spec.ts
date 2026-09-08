import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicApiReferenceObjectSchema } from "../../lib/content/models/public-api-reference-objects.models.js";
import { callToolAndParse, parseFirstJsonContent, type ToolCallResult, withTestClient } from "./test-client.js";

/** The `candidates` key is written literally so renaming the wrapper fails the test loudly. */
const getObjectDetailsResultSchema = z.object({
	candidates: z.array(publicApiReferenceObjectSchema),
});

const callGetObjectDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof getObjectDetailsResultSchema>>> =>
	await callToolAndParse({ schema: getObjectDetailsResultSchema, text, toolName: "get-object-details" });

describe("get-object-details tool (in-memory e2e)", () => {
	it("returns the object matching a description", async () => {
		const result = await callGetObjectDetails("What fields does the error object contain?");
		expect(result.record?.candidates?.[0]?.docsUrl).toBe("http://localhost:3000/learn/docs/apis/sync-api-v2/errors#error-object");
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
