import { search } from "../lib/public-api.js";
import { logger } from "../lib/utils/logger.js";

const query = "How do I turn on enhanced security mode for delivery API?";

logger.log({ message: `Searching: "${query}"`, type: "process" });

const results = await search(query);

logger.log({ message: `${results.length} result${results.length === 1 ? "" : "s"}`, type: "completed" });

results.forEach((result, index) => {
	const snippet = result.body.replaceAll(/\s+/g, " ").trim().slice(0, 200);
	logger.log({
		message: ["", `${index + 1}. ${result.title}  ·  score ${result.score}`, `   ${result.url}`, `   ${snippet}…`].join("\n"),
	});
});
