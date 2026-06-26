import type { TableDefinition } from "../utils/db-utils.js";
import { EMBEDDING_DIM } from "./config.js";

export const DOCUMENTS_TABLE = {
	tableName: "documents",
	columns: {
		id: { name: "id", type: "TEXT", primaryKey: true },
		title: { name: "title", type: "TEXT", notNull: true },
		url: { name: "url", type: "TEXT", notNull: true },
		body: { name: "body", type: "TEXT", notNull: true },
		contentHash: { name: "contentHash", type: "TEXT", notNull: true },
		lastModified: { name: "lastModified", type: "TEXT" },
	},
} as const satisfies TableDefinition<"documents", "id" | "title" | "url" | "body" | "contentHash" | "lastModified">;

export const CHUNKS_TABLE = {
	tableName: "chunks",
	columns: {
		id: { name: "id", type: "INTEGER", primaryKey: true },
		chunkKey: { name: "chunkKey", type: "TEXT", notNull: true, unique: true },
		docId: { name: "docId", type: "TEXT", notNull: true },
		chunkIndex: { name: "chunkIndex", type: "INTEGER", notNull: true },
		text: { name: "text", type: "TEXT", notNull: true },
		embedding: { name: "embedding", type: `F32_BLOB(${EMBEDDING_DIM})` },
		embeddingModel: { name: "embeddingModel", type: "TEXT" },
	},
} as const satisfies TableDefinition<"chunks", "id" | "chunkKey" | "docId" | "chunkIndex" | "text" | "embedding" | "embeddingModel">;
