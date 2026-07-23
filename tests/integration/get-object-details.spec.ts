import { tryCatch } from "@kontent-ai/core-sdk";
import { describe, expect, it } from "vitest";
import { type ApiReferenceObject, apiReferenceObjectSchema } from "../../lib/content/models/api-reference-objects.models.js";
import type { ToolName } from "../../lib/tools/shared/tool-models.js";
import { withTestClient } from "./test-client.js";

type TextContent = { readonly type: string; readonly text: string };

type Result =
	| {
			readonly record: ApiReferenceObject;
			readonly success: true;
			readonly error?: never;
	  }
	| {
			readonly error: unknown;
			readonly record?: never;
			readonly success: false;
	  };

const callGetObjectDetails = async (text: string): Promise<Result> =>
	withTestClient(async (client) => {
		const res = await client.callTool({ name: "get-object-details" satisfies ToolName, arguments: { text } });
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

		const { data, error } = apiReferenceObjectSchema.safeParse(parsedItem);
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
