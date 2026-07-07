import { tryCatchAsync } from "@kontent-ai/core-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../lib/server.js";

export const withTestClient = async <T>(fn: (client: Client) => Promise<T>): Promise<T> => {
	const { client, close } = await createTestClient();
	const { success, data, error } = await tryCatchAsync<T>(async () => {
		return await fn(client);
	});

	if (!success) {
		await close();
		throw error;
	}

	return data;
};

const createTestClient = async () => {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const { server } = createServer();
	const client = new Client({ name: "test-client", version: "0.0.0" });

	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	const close = async () => {
		await client.close();
		await server.close();
	};

	return { client, close } as const;
};
