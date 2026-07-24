import { tryCatch } from "@kontent-ai/core-sdk";
import { describe, expect, it } from "vitest";
import { type ApiReferenceEndpoint, apiReferenceEndpointSchema } from "../../lib/content/models/api-reference-endpoints.models.js";
import type { ToolName } from "../../lib/tools/shared/tool-models.js";
import { withTestClient } from "./test-client.js";

type TextContent = { readonly type: string; readonly text: string };

type Result =
	| {
			readonly record: ApiReferenceEndpoint;
			readonly success: true;
			readonly error?: never;
	  }
	| {
			readonly error: unknown;
			readonly record?: never;
			readonly success: false;
	  };

const callGetEndpointDetails = async (text: string): Promise<Result> =>
	withTestClient(async (client) => {
		const res = await client.callTool({ name: "get-endpoint-details" satisfies ToolName, arguments: { text } });
		expect(res.isError).toBeFalsy();

		const content = res.content as readonly TextContent[];
		const textOfFirstItem = content.at(0)?.text;
		const { data: parsedItem, error: parseError } = tryCatch(() => JSON.parse(textOfFirstItem ?? "") as unknown);

		if (parseError) {
			return {
				error: parseError,
				success: false,
			};
		}

		const { data, error } = apiReferenceEndpointSchema.safeParse(parsedItem);
		if (data) {
			return {
				record: data,
				success: true,
			};
		}
		return {
			error,
			success: false,
		};
	});

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
