import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import { type SearchRecordType, searchRecordTypeSchema } from "../content/models/search-records.models.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

const documentDistanceRow = z.readonly(
	z.object({
		body: z.string(),
		codename: z.string(),
		distance: z.number(),
		title: z.string(),
		type: searchRecordTypeSchema,
		url: z.url(),
	}),
);

type DocumentDistanceRow = z.infer<typeof documentDistanceRow>;

export async function getDocumentsFromDb({
	db,
	queryVector,
	limit,
	type,
}: {
	readonly db: Database;
	readonly queryVector: Float32Array;
	readonly limit: number;
	readonly type?: SearchRecordType;
}): Promise<readonly SearchResult[]> {
	const c = CHUNKS_TABLE.columns;
	const d = DOCUMENTS_TABLE.columns;
	// Rank documents by their best (smallest cosine distance) chunk; grouping in SQL
	// Keeps one row per document. vector_distance_cos returns 1 - cosineSimilarity.
	// Filtering by type here (rather than after LIMIT) keeps a type-specific lookup from
	// Losing to unrelated types that rank higher in the global top-N.
	const sql = `SELECT doc.${d.title.name}, doc.${d.url.name}, doc.${d.body.name}, doc.${d.type.name}, doc.${d.codename.name},
			MIN(vector_distance_cos(chunk.${c.embedding.name}, vector32(?))) AS distance
		FROM ${CHUNKS_TABLE.tableName} chunk
		JOIN ${DOCUMENTS_TABLE.tableName} doc ON doc.${d.id.name} = chunk.${c.docId.name}
		WHERE chunk.${c.embedding.name} IS NOT NULL ${type ? `AND doc.${d.type.name} = ?` : ""}
		GROUP BY doc.${d.id.name}
		ORDER BY distance ASC
		LIMIT ?`;
	const params = type ? [toVectorParam(queryVector), type, limit] : [toVectorParam(queryVector), limit];
	const rows = await db.all(sql, ...params);

	const invalidRows = rows.filter((row) => !isDocumentDistanceRow(row));

	if (invalidRows.length > 0) {
		throw new Error(
			`Unexpected result from database. Out of ${colorize("yellow", rows.length.toString())} rows, ${colorize("red", invalidRows.length.toString())} do not match the expected schema.`,
		);
	}

	return rows
		.filter((row) => isDocumentDistanceRow(row))
		.map((row) => ({
			body: row.body,
			codename: row.codename,
			score: round(1 - row.distance, 4),
			title: row.title,
			type: row.type,
			url: row.url,
		}));
}

function isDocumentDistanceRow(data: unknown): data is DocumentDistanceRow {
	return documentDistanceRow.safeParse(data).success;
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}
