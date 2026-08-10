import { describe, expect, it } from "vitest";
import type { z } from "zod/mini";
import { apiReferenceObjectSchema } from "../../lib/content/models/api-reference-objects.models.js";
import { callToolAndParse, type ToolCallResult } from "./test-client.js";

const callGetObjectDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof apiReferenceObjectSchema>>> =>
	await callToolAndParse({ schema: apiReferenceObjectSchema, text, toolName: "get-object-details" });

describe("get-object-details tool (in-memory e2e)", () => {
	it("returns the object matching a description", async () => {
		const result = await callGetObjectDetails("What fields does the error object contain?");
		expect(result.record?.codename).toBe("error_object");
	});

	it("returns the object matching its name", async () => {
		const result = await callGetObjectDetails("object representing a language");
		expect(result.record?.codename).toBe("dapi_language");
	});
});
