import { EMBEDDING_DIM } from "../config.js";
import type { SearchRecordType } from "../content/models/search-records.models.js";
import type { TableDefinition } from "./db.utils.js";

export interface DocumentRow {
	readonly id: string;
	readonly codename: string;
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly contentHash: string;
	readonly lastModified: string | null;
	readonly type: SearchRecordType;
}

export interface ChunkRow {
	readonly id: number;
	readonly chunkKey: string;
	readonly docId: string;
	readonly chunkIndex: number;
	readonly text: string;
	readonly embedding: Uint8Array | null;
	readonly embeddingModel: string | null;
}

export const DOCUMENTS_TABLE: TableDefinition<"documents", DocumentRow> = {
	columns: {
		body: { name: "body", notNull: true, type: "TEXT" },
		codename: { name: "codename", notNull: true, type: "TEXT" },
		contentHash: { name: "contentHash", notNull: true, type: "TEXT" },
		id: { name: "id", primaryKey: true, type: "TEXT" },
		lastModified: { name: "lastModified", type: "TEXT" },
		title: { name: "title", notNull: true, type: "TEXT" },
		type: { name: "type", notNull: true, type: "TEXT" },
		url: { name: "url", notNull: true, type: "TEXT" },
	},
	tableName: "documents",
};

export const CHUNKS_TABLE: TableDefinition<"chunks", ChunkRow> = {
	columns: {
		chunkIndex: { name: "chunkIndex", notNull: true, type: "INTEGER" },
		chunkKey: { name: "chunkKey", notNull: true, type: "TEXT", unique: true },
		docId: { name: "docId", notNull: true, type: "TEXT" },
		embedding: { name: "embedding", type: `F32_BLOB(${EMBEDDING_DIM})` },
		embeddingModel: { name: "embeddingModel", type: "TEXT" },
		id: { name: "id", primaryKey: true, type: "INTEGER" },
		text: { name: "text", notNull: true, type: "TEXT" },
	},
	tableName: "chunks",
};

/** Serialise a vector for Turso's `vector32(?)` SQL function. */
export const toVectorParam = (vector: Float32Array): string => JSON.stringify([...vector]);
