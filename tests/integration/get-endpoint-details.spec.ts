import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicApiReferenceEndpointSchema } from "../../lib/content/models/public-api-reference-endpoints.models.js";
import { callToolAndParse, type ToolCallResult } from "./test-client.js";

const publicApiReferenceEndpointsSchema = z.array(publicApiReferenceEndpointSchema);

const callGetEndpointDetails = async (text: string): Promise<ToolCallResult<z.infer<typeof publicApiReferenceEndpointsSchema>>> =>
	await callToolAndParse({ schema: publicApiReferenceEndpointsSchema, text, toolName: "get-endpoint-details" });

describe("get-endpoint-details tool (in-memory e2e)", () => {
	it("returns the endpoint matching a specific URL", async () => {
		const result = await callGetEndpointDetails("How do I get content type?");
		expect(result.record?.[0]?.title).toBe("Retrieve a content type");
	});

	it("returns the endpoint matching an action description", async () => {
		const result = await callGetEndpointDetails("I want to fetch all taxonomy groups in my project");
		expect(result.record?.[0]?.title).toBe("List taxonomy groups");
	});
});
