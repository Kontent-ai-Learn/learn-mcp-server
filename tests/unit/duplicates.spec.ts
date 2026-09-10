import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findDuplicateKeys } from "../../lib/utils/duplicates.utils.js";

const doc = (id: string, codename = id): { readonly id: string; readonly codename: string } => ({ codename, id });

describe("findDuplicateKeys", () => {
	it("reports a key that occurs more than once", () => {
		const docs = [doc("a"), doc("b"), doc("a")];

		expect(findDuplicateKeys(docs, (item) => item.id)).toEqual(["a"]);
	});

	it("reports nothing when every key is distinct", () => {
		const docs = [doc("a"), doc("b"), doc("c")];

		expect(findDuplicateKeys(docs, (item) => item.id)).toEqual([]);
	});

	it("reports a key once however many times it repeats", () => {
		const docs = [doc("a"), doc("a"), doc("a")];

		expect(findDuplicateKeys(docs, (item) => item.id)).toEqual(["a"]);
	});

	it("keys on the selector, so records colliding on one field but not another are distinguished", () => {
		const docs = [doc("id-1", "shared"), doc("id-2", "shared")];

		expect(findDuplicateKeys(docs, (item) => item.id)).toEqual([]);
		expect(findDuplicateKeys(docs, (item) => item.codename)).toEqual(["shared"]);
	});

	it("returns duplicates in first-seen order", () => {
		const docs = [doc("b"), doc("a"), doc("b"), doc("a")];

		expect(findDuplicateKeys(docs, (item) => item.id)).toEqual(["b", "a"]);
	});

	it("handles an empty input", () => {
		expect(findDuplicateKeys([], (item: { readonly id: string }) => item.id)).toEqual([]);
	});
});

describe("test fixture data", () => {
	/** The guard must stay silent on the test corpus, or every test run drowns in warnings. */
	it("has no colliding ids or api-reference codenames", async () => {
		const path = fileURLToPath(new URL("../../samples/test-db-source-docs.json", import.meta.url));
		const { searchRecords, apiReferenceEndpoints, apiReferenceObjects } = JSON.parse(await readFile(path, "utf8")) as {
			readonly searchRecords: readonly { readonly id: string }[];
			readonly apiReferenceEndpoints: readonly { readonly codename: string }[];
			readonly apiReferenceObjects: readonly { readonly id: string; readonly codename: string }[];
		};

		expect(findDuplicateKeys([...searchRecords, ...apiReferenceObjects], (record) => record.id)).toEqual([]);
		expect(findDuplicateKeys([...apiReferenceEndpoints, ...apiReferenceObjects], (record) => record.codename)).toEqual([]);
	});
});
