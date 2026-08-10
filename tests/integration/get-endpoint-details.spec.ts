import { describe, expect, it } from "vitest";
import type { z } from "zod/mini";
import { apiReferenceEndpointSchema } from "../../lib/content/models/api-reference-endpoints.models.js";
import { callToolAndParse, type ToolCallResult } from "./test-client.js";

const callGetEndpointDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof apiReferenceEndpointSchema>>> =>
	await callToolAndParse({ schema: apiReferenceEndpointSchema, text, toolName: "get-endpoint-details" });

describe("get-endpoint-details tool (in-memory e2e)", () => {
	it("returns the endpoint matching a specific URL", async () => {
		const result = await callGetEndpointDetails("How do I get content type?");
		expect(result.record?.codename).toBe("retrieve_a_content_type_384b00d");
	});

	it("returns the endpoint matching an action description", async () => {
		const result = await callGetEndpointDetails("I want to fetch all taxonomy groups in my project");
		expect(result.record?.codename).toBe("list_taxonomy_groups");
	});
});
