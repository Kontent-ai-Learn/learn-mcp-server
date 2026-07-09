import { describe, expect, it } from "vitest";
import { mapSegmentToSourceDoc } from "../../lib/indexing/source.js";

describe("toSourceDoc", () => {
	const segment = {
		id: "webhooks",
		title: "Webhooks",
		url: "/learn/webhooks",
		text: "<h2>Webhooks</h2><p>Notify an <strong>external</strong> system.</p><ul><li>One</li><li>Two</li></ul>",
	};

	it("passes id, title and url through unchanged", () => {
		const doc = mapSegmentToSourceDoc(segment);
		expect(doc.id).toBe("webhooks");
		expect(doc.title).toBe("Webhooks");
		expect(doc.url).toBe("/learn/webhooks");
	});

	it("converts the HTML text to Markdown (no tags, structure preserved)", () => {
		const { markdown } = mapSegmentToSourceDoc(segment);
		expect(markdown).not.toMatch(/<[a-z]/i); // no HTML tags remain
		expect(markdown).toContain("## Webhooks"); // heading -> markdown
		expect(markdown).toContain("**external**"); // <strong> -> bold
		expect(markdown).toContain("Notify an **external** system.");
		expect(markdown).toMatch(/[*-] One/); // list item -> markdown bullet
	});
});
