import { type TryCatchResult, tryCatch, tryCatchAsync } from "@kontent-ai/core-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createServer } from "../../lib/server.js";

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
