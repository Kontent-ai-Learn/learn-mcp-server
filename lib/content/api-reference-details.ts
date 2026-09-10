import type { ApiReferenceCodenames } from "../config.js";
import { LearnMcpExceptionError } from "../exceptions/learn-mcp-exception.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import { search } from "../search/search.js";
import { getApiReferenceEndpointsFromCache } from "./api-reference-endpoints.js";
import { getApiReferenceObjectsFromCache } from "./api-reference-objects.js";
import type { ApiReferenceEndpoint } from "./models/api-reference-endpoints.models.js";
import type { ApiReferenceObject } from "./models/api-reference-objects.models.js";
import type { SearchRecordType } from "./models/search-records.models.js";

type ItemWithScore = {
	readonly score: number;
};

/**
 * Codename is the only key a cached record and a search hit reliably share. Endpoint documents come
 * from the search-records feed, whose page-scoped ids never match an endpoint record's own id, so
 * `id` is not an option there.
 */
type ApiReferenceRecord = {
	readonly codename: string;
	readonly apiReference: string;
};

export async function getEndpointDetails<TPublicType extends ItemWithScore>({
	text,
	apiReference,
	mapRecordToPublicType,
}: {
	readonly text: string;
	readonly apiReference: ApiReferenceCodenames | undefined;
	readonly mapRecordToPublicType: (record: ApiReferenceEndpoint, score: number) => TPublicType;
}): Promise<readonly TPublicType[]> {
	return await findDetailsBySearch<ApiReferenceEndpoint, TPublicType>({
		getRecordsFromCache: getApiReferenceEndpointsFromCache,
		label: "endpoint",
		text,
		type: "endpoint",
		apiReference,
		mapRecordToPublicType,
	});
}

export async function getObjectDetails<TPublicType extends ItemWithScore>({
	text,
	apiReference,
	mapRecordToPublicType,
}: {
	readonly text: string;
	readonly apiReference: ApiReferenceCodenames | undefined;
	readonly mapRecordToPublicType: (record: ApiReferenceObject, score: number) => TPublicType;
}): Promise<readonly TPublicType[]> {
	return await findDetailsBySearch<ApiReferenceObject, TPublicType>({
		getRecordsFromCache: getApiReferenceObjectsFromCache,
		label: "object",
		text,
		type: "object",
		apiReference,
		mapRecordToPublicType,
	});
}

async function findDetailsBySearch<TRecord extends ApiReferenceRecord, TPublicType extends ItemWithScore>({
	text,
	type,
	label,
	getRecordsFromCache,
	apiReference,
	mapRecordToPublicType,
}: {
	readonly text: string;
	readonly type: SearchRecordType;
	readonly label: string;
	readonly getRecordsFromCache: () => readonly TRecord[] | undefined;
	readonly mapRecordToPublicType: (record: TRecord, score: number) => TPublicType;
	apiReference: ApiReferenceCodenames | undefined;
}): Promise<readonly TPublicType[]> {
	const records = getRecordsFromCache();

	if (!records) {
		throw new LearnMcpExceptionError(
			"cacheNotInitialized",
			`Could not fetch learn ${label} records. Run indexer to initialize the cache.`,
		);
	}

	const searchResults = await search({ query: text, type, apiReference });
	// A caller that named an API has no ambiguity to resolve, so don't hand back other APIs' records.
	const candidates = apiReference ? records.filter((record) => record.apiReference === apiReference) : records;

	return getTopMatches({ mapRecordToPublicType, records: candidates, searchResults });
}

/**
 * A codename can name several records — one schema object reused by two APIs yields one record per
 * API. Rather than guess, every record under the matched codename is returned and the caller picks.
 *
 * Each of those records is usually also its own search hit, so expanding every hit would emit the
 * same record once per sibling. Keeping the first occurrence collapses that: search results arrive
 * ordered by score, so the first one a record appears under is its best.
 */
function getTopMatches<TRecord extends ApiReferenceRecord, TPublicType extends ItemWithScore>({
	records,
	searchResults,
	mapRecordToPublicType,
}: {
	readonly records: readonly TRecord[];
	readonly searchResults: readonly SearchResult[];
	readonly mapRecordToPublicType: (record: TRecord, score: number) => TPublicType;
}): readonly TPublicType[] {
	const recordsByCodename = groupByCodename(records);
	const bestScoreByRecord = searchResults.reduce<Map<TRecord, number>>((acc, match) => {
		for (const record of recordsByCodename.get(match.codename) ?? []) {
			if (!acc.has(record)) {
				acc.set(record, match.score);
			}
		}
		return acc;
	}, new Map());

	return [...bestScoreByRecord].map(([record, score]) => mapRecordToPublicType(record, score)).toSorted((a, b) => b.score - a.score);
}

function groupByCodename<TRecord extends ApiReferenceRecord>(records: readonly TRecord[]): ReadonlyMap<string, readonly TRecord[]> {
	return records.reduce<Map<string, readonly TRecord[]>>(
		(acc, record) => acc.set(record.codename, [...(acc.get(record.codename) ?? []), record]),
		new Map(),
	);
}
