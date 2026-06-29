import { describe, expect, it } from "vitest";
import { toSourceDoc } from "../../lib/indexing/source.js";

describe("toSourceDoc", () => {
	const segment = {
		id: "webhooks",
		title: "Webhooks",
		url: "/learn/webhooks",
		text: "<h2>Webhooks</h2><p>Notify an <strong>external</strong> system.</p><ul><li>One</li><li>Two</li></ul>",
	};

	it("passes id, title and url through unchanged", () => {
		const doc = toSourceDoc(segment);
		expect(doc.id).toBe("webhooks");
		expect(doc.title).toBe("Webhooks");
		expect(doc.url).toBe("/learn/webhooks");
	});

	it("converts the HTML text to Markdown (no tags, structure preserved)", () => {
		const { body } = toSourceDoc(segment);
		expect(body).not.toMatch(/<[a-z]/i); // no HTML tags remain
		expect(body).toContain("## Webhooks"); // heading -> markdown
		expect(body).toContain("**external**"); // <strong> -> bold
		expect(body).toContain("Notify an **external** system.");
		expect(body).toMatch(/[*-] One/); // list item -> markdown bullet
	});
});
