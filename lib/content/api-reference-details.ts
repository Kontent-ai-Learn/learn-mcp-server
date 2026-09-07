import { isDefined, type JsonValue } from "@kontent-ai/core-sdk";
import type { ApiReferenceCodenames } from "../config.js";
import type { SearchResult } from "../indexing/indexer.models.js";
import { search } from "../search/search.js";
import { getApiReferenceEndpointsFromCache } from "./api-reference-endpoints.js";
import { getApiReferenceObjectsFromCache } from "./api-reference-objects.js";
import type { SearchRecordType } from "./models/search-records.models.js";

type RecordWithScore = {
	readonly score: number;
};

export async function getEndpointDetails(text: string, apiReference: ApiReferenceCodenames | undefined): Promise<JsonValue> {
	return await findDetailsBySearch({
		getRecordsFromCache: getApiReferenceEndpointsFromCache,
		label: "endpoint",
		text,
		type: "endpoint",
		apiReference,
	});
}

export async function getObjectDetails(text: string, apiReference: ApiReferenceCodenames | undefined): Promise<JsonValue> {
	return await findDetailsBySearch({
		getRecordsFromCache: getApiReferenceObjectsFromCache,
		label: "object",
		text,
		type: "object",
		apiReference,
	});
}

async function findDetailsBySearch<TRecord extends JsonValue & { readonly codename: string }>({
	text,
	type,
	label,
	getRecordsFromCache,
	apiReference,
}: {
	readonly text: string;
	readonly type: SearchRecordType;
	readonly label: string;
	readonly getRecordsFromCache: () => readonly TRecord[] | undefined;
	apiReference: ApiReferenceCodenames | undefined;
}): Promise<JsonValue> {
	const searchResults = await search({ query: text, type, apiReference });
	const topResult = searchResults?.[0];

	if (!topResult) {
		return `Could not find ${label} details for the given input.`;
	}

	const records = getRecordsFromCache();

	if (!records) {
		return "Could not fetch learn records. Run indexer to initialize the cache.";
	}

	return getTopMatches(records, searchResults);
}

function getTopMatches<T extends { readonly codename: string }>(
	records: readonly T[],
	searchResults: readonly SearchResult[],
): readonly (T & RecordWithScore)[] {
	return searchResults
		.map<[SearchResult, T] | undefined>((m) => {
			const record = records.find((s) => s.codename === m.codename);

			if (!record) {
				return undefined;
			}

			return [m, record];
		})
		.filter(isDefined)
		.map<T & RecordWithScore>((m) => ({ score: m[0].score, ...m[1] }))
		.toSorted((a, b) => b.score - a.score);
}
