import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicApiReferenceEndpointSchema } from "../../lib/content/models/public-api-reference-endpoints.models.js";
import { callToolAndParse, parseFirstJsonContent, type ToolCallResult, withTestClient } from "./test-client.js";

/** The `candidates` key is written literally so renaming the wrapper fails the test loudly. */
const getEndpointDetailsResultSchema = z.object({
	candidates: z.array(publicApiReferenceEndpointSchema),
});

const callGetEndpointDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof getEndpointDetailsResultSchema>>> =>
	await callToolAndParse({ schema: getEndpointDetailsResultSchema, text, toolName: "get-endpoint-details" });

describe("get-endpoint-details tool (in-memory e2e)", () => {
	it("returns the endpoint matching a specific URL", async () => {
		const result = await callGetEndpointDetails("How do I get content type?");
		expect(result.record?.candidates?.[0]?.title).toBe("Retrieve a content type");
	});

	it("returns the endpoint matching an action description", async () => {
		const result = await callGetEndpointDetails("I want to fetch all taxonomy groups in my project");
		expect(result.record?.candidates?.[0]?.title).toBe("List taxonomy groups");
	});

	it("mirrors structuredContent in the text content block", async () => {
		await withTestClient(async (client) => {
			const res = await client.callTool({ arguments: { text: "How do I get content type?" }, name: "get-endpoint-details" });
			const { data: parsedText } = parseFirstJsonContent(res);

			expect(res.structuredContent).toEqual(parsedText);
		});
	});
});
