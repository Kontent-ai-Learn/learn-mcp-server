import type { JsonValue } from "@kontent-ai/core-sdk";
import { search } from "../search/search.js";
import { getApiReferenceEndpointsFromCache } from "./api-reference-endpoints.js";
import { getApiReferenceObjectsFromCache } from "./api-reference-objects.js";
import type { SearchRecordType } from "./models/search-records.models.js";

export async function getEndpointDetails(text: string): Promise<JsonValue> {
	return await findDetailsBySearch({
		getRecordsFromCache: getApiReferenceEndpointsFromCache,
		label: "endpoint",
		text,
		type: "endpoint",
	});
}

export async function getObjectDetails(text: string): Promise<JsonValue> {
	return await findDetailsBySearch({
		getRecordsFromCache: getApiReferenceObjectsFromCache,
		label: "object",
		text,
		type: "object",
	});
}

/**
 * Shared core for the "get X details" queries: semantic-search for the best matching document
 * of the given type, then return the full cached record with the same codename. Returns a
 * human-readable message string when nothing matches — used verbatim as both the MCP tool
 * result and the HTTP route's 200 JSON body.
 */
async function findDetailsBySearch<TRecord extends JsonValue & { readonly codename: string }>({
	text,
	type,
	label,
	getRecordsFromCache,
}: {
	readonly text: string;
	readonly type: SearchRecordType;
	readonly label: string;
	readonly getRecordsFromCache: () => readonly TRecord[] | undefined;
}): Promise<JsonValue> {
	const searchResults = await search(text, type);
	const topResult = searchResults?.[0];

	if (!topResult) {
		return `Could not find ${label} details for the given input.`;
	}

	const records = getRecordsFromCache();

	if (!records) {
		return "Could not fetch learn records. Run indexer to initialize the cache.";
	}

	return (
		records.find((record) => record.codename === topResult.codename) ??
		`Found candidate ${label} but could not retrieve its details. Requested codename: ${topResult.codename}`
	);
}
