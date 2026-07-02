import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../lib/server.js";

export const withTestClient = async <T>(fn: (client: Client) => Promise<T>): Promise<T> => {
	const { client, close } = await createTestClient();
	try {
		return await fn(client);
	} finally {
		await close();
	}
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
