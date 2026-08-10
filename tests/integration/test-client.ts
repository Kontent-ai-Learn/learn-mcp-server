import { type TryCatchResult, tryCatch, tryCatchAsync } from "@kontent-ai/core-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect } from "vitest";
import { z } from "zod";
import { createServer } from "../../lib/server.js";
import type { ToolName } from "../../lib/tools/shared/tool-models.js";

export type ToolCallResult<T> =
	| { readonly record: T; readonly success: true; readonly error?: never }
	| { readonly error: unknown; readonly record?: never; readonly success: false };

const textContentBlockSchema = z.object({
	text: z.string(),
	type: z.literal("text"),
});

const toolCallResultSchema = z.object({
	content: z.array(textContentBlockSchema),
});

export const withTestClient = async <T>(fn: (client: Client) => Promise<T>): Promise<T> => {
	const { client, close } = await createTestClient();
	const { success, data, error } = await tryCatchAsync<T>(async () => await fn(client));

	if (!success) {
		await close();
		throw error;
	}

	return data;
};

/** Parses the JSON text of the first content item in an MCP tool-call response. */
export function parseFirstJsonContent(res: unknown): TryCatchResult<unknown> {
	const { data, success } = toolCallResultSchema.safeParse(res);
	if (!success) {
		return { error: new Error("Expected res to be a tool-call result with a non-empty array of text content blocks"), success: false };
	}
	return tryCatch(() => JSON.parse(data.content.at(0)?.text ?? "") as unknown);
}

/** Calls a tool, parses its first JSON content block, and validates it against `schema`. */
export async function callToolAndParse<T>({
	toolName,
	schema,
	text,
}: {
	readonly toolName: ToolName;
	readonly schema: { readonly safeParse: (data: unknown) => { readonly data?: T; readonly error?: unknown } };
	readonly text: string;
}): Promise<ToolCallResult<T>> {
	return await withTestClient(async (client) => {
		const res = await client.callTool({ arguments: { text }, name: toolName });
		expect(res.isError).toBeFalsy();

		const { data: parsedItem, error: parseError } = parseFirstJsonContent(res);
		if (parseError) {
			return { error: parseError, success: false };
		}

		const { data, error } = schema.safeParse(parsedItem);
		if (data) {
			return { record: data, success: true };
		}
		return { error, success: false };
	});
}

const createTestClient = async (): Promise<{ readonly client: Client; readonly close: () => Promise<void> }> => {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const { server } = createServer();
	const client = new Client({ name: "test-client", version: "0.0.0" });

	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	const close = async (): Promise<void> => {
		await client.close();
		await server.close();
	};

	return { client, close } as const;
};
