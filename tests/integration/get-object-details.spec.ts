import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicApiReferenceObjectSchema } from "../../lib/content/models/public-api-reference-objects.models.js";
import { callToolAndParse, type ToolCallResult } from "./test-client.js";

const publicApiReferenceObjectsSchema = z.array(publicApiReferenceObjectSchema);

const callGetObjectDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof publicApiReferenceObjectsSchema>>> =>
	await callToolAndParse({ schema: publicApiReferenceObjectsSchema, text, toolName: "get-object-details" });

describe("get-object-details tool (in-memory e2e)", () => {
	it("returns the object matching a description", async () => {
		const result = await callGetObjectDetails("What fields does the error object contain?");
		expect(result.record?.[0]?.docsUrl).toBe("http://localhost:3000/learn/docs/apis/sync-api-v2/errors#error-object");
	});

	it("returns the object matching its name", async () => {
		const result = await callGetObjectDetails("object representing a language");
		expect(result.record?.[0]?.docsUrl).toBe("http://localhost:3000/learn/docs/apis/delivery-api/languages#language-object");
	});
});
