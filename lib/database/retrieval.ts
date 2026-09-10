import { colorize } from "@kontent-ai/core-sdk/devkit";
import type { Database } from "@tursodatabase/database";
import { z } from "zod";
import { type ApiReferenceCodenames, BODY_SCORE_WEIGHT, SEARCH_SCORE_THRESHOLD, TITLE_SCORE_WEIGHT } from "../config.js";
import { type SearchRecordType, searchRecordTypeSchema } from "../content/models/search-records.models.js";
import type { ChunkSourceField, SearchResult } from "../indexing/indexer.models.js";
import type { SqlValue } from "./db.utils.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

type SearchQueryParams = Readonly<Record<string, SqlValue>>;

const documentScoreRow = z.compile(
	z
		.object({
			body: z.string(),
			codename: z.string(),
			score: z.number(),
			title: z.string(),
			type: searchRecordTypeSchema,
			url: z.url(),
		})
		.readonly(),
);

type DocumentScoreRow = z.infer<typeof documentScoreRow>;

const TITLE_SOURCE_FIELD: ChunkSourceField = "title";
const BODY_SOURCE_FIELD: ChunkSourceField = "body";

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
	const rows = await db.all(sql, params);
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
}): { readonly sql: string; readonly params: SearchQueryParams } {
	const d = DOCUMENTS_TABLE.columns;
	const filterClause = [
		...(type ? [`AND doc.${d.type.name} = :type`] : []),
		...(apiReference ? [`AND doc.${d.apiReference.name} = :apiReference`] : []),
	].join(" ");

	// Unreferenced named parameters are ignored by the driver, so the filter values can be bound
	// unconditionally even when their conjunct is absent from the SQL.
	const params: SearchQueryParams = {
		apiReference: apiReference ?? null,
		bodySourceField: BODY_SOURCE_FIELD,
		bodyWeight: BODY_SCORE_WEIGHT,
		limit,
		queryVector: toVectorParam(queryVector),
		titleSourceField: TITLE_SOURCE_FIELD,
		titleWeight: TITLE_SCORE_WEIGHT,
		type: type ?? null,
	};
	return { params, sql: buildSql(filterClause) };
}

function buildSql(filterClause: string): string {
	const c = CHUNKS_TABLE.columns;
	const d = DOCUMENTS_TABLE.columns;

	const bestDistanceIn = (sourceField: string): string =>
		`MIN(CASE WHEN chunk.${c.sourceField.name} = ${sourceField} THEN vector_distance_cos(chunk.${c.embedding.name}, vector32(:queryVector)) END)`;

	// A CTE, not one SELECT: SQLite cannot reference a select-list alias from a later expression in
	// the same list, so inlining the score would spell each MIN(CASE ...) twice more. Named params
	// let the query vector appear twice in the text while being bound once.
	// The title is its own `sourceField = 'title'` chunk, so a doc with an empty body still has one chunk
	// and survives the join; its missing bodyDistance coalesces to zero similarity rather than
	// renormalising the weights, which would put title-only hits on a different scale to the rest.
	return `WITH scored AS (
			SELECT doc.${d.id.name} AS id, doc.${d.title.name} AS title, doc.${d.url.name} AS url, doc.${d.body.name} AS body, doc.${d.type.name} AS type, doc.${d.codename.name} AS codename,
				${bestDistanceIn(":titleSourceField")} AS titleDistance,
				${bestDistanceIn(":bodySourceField")} AS bodyDistance
			FROM ${CHUNKS_TABLE.tableName} chunk
			JOIN ${DOCUMENTS_TABLE.tableName} doc ON doc.${d.id.name} = chunk.${c.docId.name}
			WHERE chunk.${c.embedding.name} IS NOT NULL ${filterClause}
			GROUP BY doc.${d.id.name}
		)
		SELECT title, url, body, type, codename,
			:titleWeight * (1 - titleDistance) + :bodyWeight * (1 - COALESCE(bodyDistance, 1.0)) AS score
		FROM scored
		WHERE titleDistance IS NOT NULL
		ORDER BY score DESC
		LIMIT :limit`;
}

function toSearchResults(rows: readonly unknown[]): readonly SearchResult[] {
	const parsedRows = rows.map((row) => documentScoreRow.safeParse(row));
	const invalidCount = parsedRows.filter((parsed) => !parsed.success).length;

	if (invalidCount > 0) {
		throw new Error(
			`Unexpected result from database. Out of ${colorize("yellow", rows.length.toString())} rows, ${colorize("red", invalidCount.toString())} do not match the expected schema.`,
		);
	}

	return parsedRows
		.filter((parsed): parsed is { readonly success: true; readonly data: DocumentScoreRow } => parsed.success)
		.map<SearchResult>(({ data: row }) => ({
			body: row.body,
			codename: row.codename,
			score: round(row.score, 4),
			title: row.title,
			type: row.type,
			docsUrl: row.url,
		}))
		.filter((m) => m.score >= SEARCH_SCORE_THRESHOLD);
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}
