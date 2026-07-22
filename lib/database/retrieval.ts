import type { Database } from "@tursodatabase/database";
import type { SearchRecordType } from "../content/search-records.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "./tables.js";

type DocumentDistanceRow = {
	readonly title: string;
	readonly url: string;
	readonly body: string;
	readonly type: SearchRecordType;
	readonly codename: string;
	readonly distance: number;
};

export async function getDocumentsFromDb({
	db,
	queryVector,
	limit,
}: {
	readonly db: Database;
	readonly queryVector: Float32Array;
	readonly limit: number;
}): Promise<readonly SearchResult[]> {
	const c = CHUNKS_TABLE.columns;
	const d = DOCUMENTS_TABLE.columns;
	// Rank documents by their best (smallest cosine distance) chunk; grouping in SQL
	// keeps one row per document. vector_distance_cos returns 1 - cosineSimilarity.
	const sql = `SELECT doc.${d.title.name}, doc.${d.url.name}, doc.${d.body.name}, doc.${d.type.name}, doc.${d.codename.name},
			MIN(vector_distance_cos(chunk.${c.embedding.name}, vector32(?))) AS distance
		FROM ${CHUNKS_TABLE.tableName} chunk
		JOIN ${DOCUMENTS_TABLE.tableName} doc ON doc.${d.id.name} = chunk.${c.docId.name}
		WHERE chunk.${c.embedding.name} IS NOT NULL
		GROUP BY doc.${d.id.name}
		ORDER BY distance ASC
		LIMIT ?`;
	const rows = (await db.all(sql, toVectorParam(queryVector), limit)) as readonly DocumentDistanceRow[];

	return rows.map((row) => ({
		title: row.title,
		url: row.url,
		body: row.body,
		type: row.type,
		codename: row.codename,
		score: round(1 - row.distance, 4),
	}));
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}
