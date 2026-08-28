import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod/mini";
import type { ApiReferenceCodenames } from "../config.js";
import { type SearchRecordType, searchRecordTypeSchema } from "../content/models/search-records.models.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import type { SqlValue } from "./db.utils.js";
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
	apiReference,
}: {
	readonly db: Database;
	readonly queryVector: Float32Array;
	readonly limit: number;
	readonly type?: SearchRecordType;
	readonly apiReference?: ApiReferenceCodenames;
}): Promise<readonly SearchResult[]> {
	const { sql, params } = buildSearchQuery({ apiReference, limit, queryVector, type });
	const rows = await db.all(sql, ...params);
	return toSearchResults(rows);
}

function buildSearchQuery({
	queryVector,
	limit,
	type,
	apiReference,
}: {
	readonly queryVector: Float32Array;
	readonly limit: number;
	readonly type?: SearchRecordType;
	readonly apiReference?: ApiReferenceCodenames;
}): { readonly sql: string; readonly params: readonly SqlValue[] } {
	const c = CHUNKS_TABLE.columns;
	const d = DOCUMENTS_TABLE.columns;

	const filters: readonly { readonly condition: string; readonly value: SqlValue }[] = [
		...(type ? [{ condition: `doc.${d.type.name} = ?`, value: type }] : []),
		...(apiReference ? [{ condition: `doc.${d.apiReference.name} = ?`, value: apiReference }] : []),
	];
	const filterClause = filters.map(({ condition }) => `AND ${condition}`).join(" ");

	// Rank documents by their best (smallest cosine distance) chunk; grouping in SQL
	// Keeps one row per document. vector_distance_cos returns 1 - cosineSimilarity.
	// Filtering here (rather than after LIMIT) keeps a filtered lookup from
	// Losing to unrelated rows that rank higher in the global top-N.
	const sql = `SELECT doc.${d.title.name}, doc.${d.url.name}, doc.${d.body.name}, doc.${d.type.name}, doc.${d.codename.name},
			MIN(vector_distance_cos(chunk.${c.embedding.name}, vector32(?))) AS distance
		FROM ${CHUNKS_TABLE.tableName} chunk
		JOIN ${DOCUMENTS_TABLE.tableName} doc ON doc.${d.id.name} = chunk.${c.docId.name}
		WHERE chunk.${c.embedding.name} IS NOT NULL ${filterClause}
		GROUP BY doc.${d.id.name}
		ORDER BY distance ASC
		LIMIT ?`;
	const params: readonly SqlValue[] = [toVectorParam(queryVector), ...filters.map(({ value }) => value), limit];
	return { params, sql };
}

function toSearchResults(rows: readonly unknown[]): readonly SearchResult[] {
	const parsedRows = rows.map((row) => documentDistanceRow.safeParse(row));
	const invalidCount = parsedRows.filter((parsed) => !parsed.success).length;

	if (invalidCount > 0) {
		throw new Error(
			`Unexpected result from database. Out of ${colorize("yellow", rows.length.toString())} rows, ${colorize("red", invalidCount.toString())} do not match the expected schema.`,
		);
	}

	return parsedRows
		.filter((parsed): parsed is { readonly success: true; readonly data: DocumentDistanceRow } => parsed.success)
		.map(({ data: row }) => ({
			body: row.body,
			codename: row.codename,
			score: round(1 - row.distance, 4),
			title: row.title,
			type: row.type,
			url: row.url,
		}));
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}
