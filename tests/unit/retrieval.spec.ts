import { connect, type Database } from "@tursodatabase/database";
import { match } from "ts-pattern";
import { describe, expect, it } from "vitest";
import { type ApiReferenceCodenames, EMBEDDING_DIM, TITLE_SCORE_WEIGHT } from "../../lib/config.js";
import type { SearchRecordType } from "../../lib/content/models/search-records.models.js";
import { buildCreateTableQuery } from "../../lib/database/db.utils.js";
import { getDocumentsFromDb } from "../../lib/database/retrieval.js";
import { CHUNKS_TABLE, DOCUMENTS_TABLE, toVectorParam } from "../../lib/database/tables.js";
import type { ChunkSourceField, SearchResult } from "../../lib/indexing/indexer.models.js";

interface SeedChunk {
	readonly sourceField: ChunkSourceField;
	/** Cosine similarity this chunk should have against `QUERY_VECTOR`; `null` leaves the chunk unembedded. */
	readonly similarity: number | null;
}

interface SeedDoc {
	readonly id: string;
	/** Defaults to `id`; set it explicitly to model two API variants that share one source item. */
	readonly codename?: string;
	readonly chunks: readonly SeedChunk[];
	readonly type?: SearchRecordType;
	readonly apiReference?: ApiReferenceCodenames;
}

/**
 * Unit vectors spanning the first two dimensions. The query is e0, so a vector at angle θ from e0
 * has cosine similarity cos(θ) — letting each fixture state the similarity it wants directly,
 * with no embedding model involved.
 */
const unitVectorWithSimilarity = (similarity: number): Float32Array =>
	Float32Array.from({ length: EMBEDDING_DIM }, (_, index) =>
		match(index)
			.with(0, () => similarity)
			.with(1, () => Math.sqrt(Math.max(0, 1 - similarity * similarity)))
			.otherwise(() => 0),
	);

const QUERY_VECTOR = unitVectorWithSimilarity(1);

const insertChunk = async ({
	db,
	docId,
	index,
	chunk,
}: {
	readonly db: Database;
	readonly docId: string;
	readonly index: number;
	readonly chunk: SeedChunk;
}): Promise<void> => {
	const c = CHUNKS_TABLE.columns;
	const key = `${docId}:${chunk.sourceField}:${index}`;
	const columns = [c.chunkKey.name, c.docId.name, c.chunkIndex.name, c.sourceField.name, c.text.name];
	const values = [key, docId, index, chunk.sourceField, key];

	await (chunk.similarity === null
		? db.run(`INSERT INTO ${CHUNKS_TABLE.tableName} (${columns.join(", ")}) VALUES (?, ?, ?, ?, ?)`, ...values)
		: db.run(
				`INSERT INTO ${CHUNKS_TABLE.tableName} (${[...columns, c.embedding.name].join(", ")}) VALUES (?, ?, ?, ?, ?, vector32(?))`,
				...values,
				toVectorParam(unitVectorWithSimilarity(chunk.similarity)),
			));
};

const insertDoc = async (db: Database, doc: SeedDoc): Promise<void> => {
	const d = DOCUMENTS_TABLE.columns;
	const columns = [d.id, d.codename, d.title, d.url, d.body, d.contentHash, d.type, d.apiReference].map((column) => column.name);

	await db.run(
		`INSERT INTO ${DOCUMENTS_TABLE.tableName} (${columns.join(", ")}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		doc.id,
		doc.codename ?? doc.id,
		`Title ${doc.id}`,
		`https://example.com/${doc.id}`,
		`Body ${doc.id}`,
		"hash",
		doc.type ?? "section",
		doc.apiReference ?? null,
	);

	for (const [index, chunk] of doc.chunks.entries()) {
		await insertChunk({ chunk, db, docId: doc.id, index });
	}
};

/** A fresh in-memory DB per call, so tests share no state and need no `beforeEach` teardown. */
const seededDb = async (docs: readonly SeedDoc[]): Promise<Database> => {
	const db = await connect(":memory:", { experimental: ["index_method"] });
	await db.exec([buildCreateTableQuery(DOCUMENTS_TABLE), buildCreateTableQuery(CHUNKS_TABLE)].join("\n"));

	for (const doc of docs) {
		await insertDoc(db, doc);
	}
	return db;
};

const search = async (
	docs: readonly SeedDoc[],
	options?: { readonly type?: SearchRecordType; readonly apiReference?: ApiReferenceCodenames },
): Promise<readonly SearchResult[]> =>
	await getDocumentsFromDb({ db: await seededDb(docs), limit: 10, queryVector: QUERY_VECTOR, ...options });

const codenamesOf = (results: readonly SearchResult[]): readonly string[] => results.map((result) => result.codename);
const url = (id: string): string => `https://example.com/${id}`;

/** Documents that share a codename are told apart by their url, which is per-API in the real data too. */
const urlsOf = (results: readonly SearchResult[]): readonly string[] => results.map((result) => result.docsUrl);

describe("getDocumentsFromDb scoring", () => {
	it("blends the title with the best body chunk using the configured weights", async () => {
		const results = await search([
			{
				chunks: [
					{ sourceField: "title", similarity: 1 },
					{ sourceField: "body", similarity: 0 },
					{ sourceField: "body", similarity: 0.9 },
				],
				id: "d1",
			},
		]);

		// 0.6 * 1 + 0.4 * 0.9 — proves MIN picks the *best* body chunk, not the first or the worst.
		expect(results[0]?.score).toBeCloseTo(0.96, 4);
	});

	it("ranks a strong title above a strong body", async () => {
		const results = await search([
			{
				chunks: [
					{ sourceField: "title", similarity: 0.4 },
					{ sourceField: "body", similarity: 0.9 },
				],
				id: "body-match",
			},
			{
				chunks: [
					{ sourceField: "title", similarity: 0.9 },
					{ sourceField: "body", similarity: 0.4 },
				],
				id: "title-match",
			},
		]);

		expect(codenamesOf(results)).toEqual(["title-match", "body-match"]);
		expect(results[0]?.score).toBeCloseTo(0.7, 4);
		expect(results[1]?.score).toBeCloseTo(0.6, 4);
	});
});

describe("getDocumentsFromDb edge cases", () => {
	/** Before the title chunk existed, a doc with no body had no chunks at all and the join dropped it. */
	it("returns a title-only document, scoring its missing body as zero similarity", async () => {
		const results = await search([{ chunks: [{ sourceField: "title", similarity: Math.SQRT1_2 }], id: "title-only" }]);

		expect(results).toHaveLength(1);
		expect(results[0]?.score).toBeCloseTo(TITLE_SCORE_WEIGHT * Math.SQRT1_2, 4);
	});

	it("excludes a document whose title chunk is not embedded yet", async () => {
		const results = await search([
			{
				chunks: [
					{ sourceField: "title", similarity: null },
					{ sourceField: "body", similarity: 0.9 },
				],
				id: "pending",
			},
		]);

		expect(results).toEqual([]);
	});

	it("applies the type and apiReference filters", async () => {
		const docs: readonly SeedDoc[] = [
			{
				apiReference: "delivery_api",
				chunks: [{ sourceField: "title", similarity: 0.9 }],
				id: "endpoint-delivery",
				type: "endpoint",
			},
			{ apiReference: "sync_api_v2", chunks: [{ sourceField: "title", similarity: 1 }], id: "endpoint-sync", type: "endpoint" },
			{ chunks: [{ sourceField: "title", similarity: 1 }], id: "section-doc", type: "section" },
		];

		expect(codenamesOf(await search(docs, { type: "endpoint" }))).toEqual(["endpoint-sync", "endpoint-delivery"]);
		expect(codenamesOf(await search(docs, { apiReference: "delivery_api", type: "endpoint" }))).toEqual(["endpoint-delivery"]);
	});
});

describe("getDocumentsFromDb identity", () => {
	/**
	 * A schema object reused by two APIs is indexed once per API: same codename, different url and
	 * apiReference. Each variant must stay independently filterable, since the codename alone
	 * cannot tell them apart.
	 */
	it("keeps documents that share a codename separable by url and apiReference", async () => {
		const docs: readonly SeedDoc[] = [
			{
				apiReference: "delivery_api",
				chunks: [{ sourceField: "title", similarity: 0.9 }],
				codename: "error_object",
				id: "object-delivery",
				type: "object",
			},
			{
				apiReference: "sync_api_v2",
				chunks: [{ sourceField: "title", similarity: 1 }],
				codename: "error_object",
				id: "object-sync",
				type: "object",
			},
		];

		expect(urlsOf(await search(docs, { type: "object" }))).toEqual([url("object-sync"), url("object-delivery")]);
		expect(codenamesOf(await search(docs, { type: "object" }))).toEqual(["error_object", "error_object"]);
		expect(urlsOf(await search(docs, { apiReference: "delivery_api", type: "object" }))).toEqual([url("object-delivery")]);
		expect(urlsOf(await search(docs, { apiReference: "sync_api_v2", type: "object" }))).toEqual([url("object-sync")]);
	});
});
