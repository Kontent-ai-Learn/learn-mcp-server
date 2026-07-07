import type { TableDefinition } from "../utils/db.utils.js";
import { EMBEDDING_DIM } from "./config.js";

export type DocumentRow = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly lastModified: string | null;
};

export type ChunkRow = {
	readonly id: number;
	readonly chunkKey: string;
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
	readonly embedding: Uint8Array | null;
	readonly embeddingModel: string | null;
};

export const DOCUMENTS_TABLE: TableDefinition<"documents", DocumentRow> = {
	tableName: "documents",
	columns: {
		id: { name: "id", type: "TEXT", primaryKey: true },
		title: { name: "title", type: "TEXT", notNull: true },
		url: { name: "url", type: "TEXT", notNull: true },
		body: { name: "body", type: "TEXT", notNull: true },
		contentHash: { name: "contentHash", type: "TEXT", notNull: true },
		lastModified: { name: "lastModified", type: "TEXT" },
	},
};

export const CHUNKS_TABLE: TableDefinition<"chunks", ChunkRow> = {
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
};
