import type { JsonValue } from "@kontent-ai/core-sdk";
import type { SearchRecordType } from "../../content/models/search-records.models.js";
import { search } from "../../search/search.js";

/**
 * Shared handler for the "get X details" tools: semantic-search for the best
 * matching document of the given type, then return the full cached record with
 * the same codename. Returns a human-readable message string when nothing matches.
 */
export async function findDetailsBySearch<TRecord extends JsonValue & { readonly codename: string }>({
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
