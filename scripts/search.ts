import { search } from "../lib/public-api.js";
import { logger } from "../lib/utils/logger.js";

const defaultQuery = "How do I turn on enhanced security mode for delivery API?";

/** Tuning the title/body score weights means re-running this a lot, so take the query from the CLI. */
const query = process.argv.slice(2).join(" ").trim() || defaultQuery;

logger.log({ message: `Searching: "${query}"`, type: "process" });

const results = await search({ query });

logger.log({ message: `${results.length} result${results.length === 1 ? "" : "s"}`, type: "completed" });

results.forEach((result, index) => {
	const snippet = result.body.replaceAll(/\s+/g, " ").trim().slice(0, 200);
	logger.log({
		message: ["", `${index + 1}. ${result.title}  ·  score ${result.score}`, `   ${result.docsUrl}`, `   ${snippet}…`].join("\n"),
	});
});
