import { EMBEDDING_DIM } from "../config.js";
import type { SearchRecordType } from "../content/search-records.js";
import type { TableDefinition } from "./db.utils.js";

export type DocumentRow = {
	readonly id: string;
	readonly codename: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly lastModified: string | null;
	readonly type: SearchRecordType;
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
		codename: { name: "codename", type: "TEXT", notNull: true },
		title: { name: "title", type: "TEXT", notNull: true },
		url: { name: "url", type: "TEXT", notNull: true },
		body: { name: "body", type: "TEXT", notNull: true },
		type: { name: "type", type: "TEXT", notNull: true },
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

/** Serialise a vector for Turso's `vector32(?)` SQL function. */
export const toVectorParam = (vector: Float32Array): string => JSON.stringify(Array.from(vector));
