import { isDefined, type JsonValue } from "@kontent-ai/core-sdk";
import type { ApiReferenceCodenames } from "../config.js";
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

type RecordWithCodename = {
	readonly codename: string;
};

export async function getEndpointDetails<TPublicType extends ItemWithScore>({
	text,
	apiReference,
	mapRecordToPublicType,
}: {
	readonly text: string;
	readonly apiReference: ApiReferenceCodenames | undefined;
	readonly mapRecordToPublicType: (record: ApiReferenceEndpoint, score: number) => TPublicType;
}): Promise<JsonValue> {
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
}): Promise<JsonValue> {
	return await findDetailsBySearch<ApiReferenceObject, TPublicType>({
		getRecordsFromCache: getApiReferenceObjectsFromCache,
		label: "object",
		text,
		type: "object",
		apiReference,
		mapRecordToPublicType,
	});
}

async function findDetailsBySearch<TRecord extends RecordWithCodename, TPublicType extends ItemWithScore>({
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

	return getTopMatches({ records, searchResults, mapRecordToPublicType });
}

function getTopMatches<TRecord extends RecordWithCodename, TPublicType extends ItemWithScore>({
	records,
	searchResults,
	mapRecordToPublicType,
}: {
	readonly records: readonly TRecord[];
	readonly searchResults: readonly SearchResult[];
	readonly mapRecordToPublicType: (record: TRecord, score: number) => TPublicType;
}): readonly TPublicType[] {
	return searchResults
		.map<TPublicType | undefined>((m) => {
			const record = records.find((s) => s.codename === m.codename);

			if (!record) {
				return undefined;
			}

			return mapRecordToPublicType(record, m.score);
		})
		.filter(isDefined)
		.toSorted((a, b) => b.score - a.score);
}
