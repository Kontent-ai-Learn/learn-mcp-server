import { describe, expect, it } from "vitest";
import { normalize } from "../../lib/indexing/indexer.js";
import type { DocumentToIndex } from "../../lib/indexing/indexer.models.js";

const noApiReferences: ReadonlyMap<string, string> = new Map();

const record: DocumentToIndex = {
	codename: "list_content_items",
	description: "Retrieve a list of content items.",
	id: "doc-1",
	title: "List content items",
	type: "endpoint",
	url: "https://example.com/items",
};

const hashOf = (overrides: Partial<DocumentToIndex> = {}, apiReferences = noApiReferences): string =>
	normalize({ ...record, ...overrides }, apiReferences).contentHash;

describe("contentHash", () => {
	it("is stable for an unchanged record", () => {
		expect(hashOf()).toBe(hashOf());
	});

	/**
	 * The guard that matters: codename resolves a search hit back to its API-reference record, so a
	 * codename-only source change must re-index. Hashing without it left the DB holding stale
	 * codenames while the cache held new ones, silently breaking the join.
	 */
	it("changes when only the codename changes", () => {
		expect(hashOf({ codename: "delivery_api_list_content_items" })).not.toBe(hashOf());
	});

	it("changes when only the type changes", () => {
		expect(hashOf({ type: "section" })).not.toBe(hashOf());
	});

	it("changes when only the apiReference changes", () => {
		const delivery = new Map([[record.codename, "delivery_api"]]);
		const sync = new Map([[record.codename, "sync_api_v2"]]);

		expect(hashOf({}, delivery)).not.toBe(hashOf({}, sync));
	});

	it.each([
		["title", { title: "Retrieve a content item" }],
		["url", { url: "https://example.com/other" }],
		["description", { description: "Something else entirely." }],
	])("changes when only the %s changes", (_field, overrides: Partial<DocumentToIndex>) => {
		expect(hashOf(overrides)).not.toBe(hashOf());
	});

	/** Field values are joined before hashing, so a naive concatenation could alias across boundaries. */
	it("does not alias when text shifts between adjacent fields", () => {
		expect(hashOf({ title: "List content", url: "items" })).not.toBe(hashOf({ title: "List", url: "content items" }));
	});
});
