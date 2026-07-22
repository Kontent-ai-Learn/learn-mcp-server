import { search } from "../lib/public_api.js";
import { logger } from "../lib/utils/logger.js";

const query = "How do I turn on enhanced security mode for delivery API?";

logger.log({ type: "process", message: `Searching: "${query}"` });

const results = await search(query);

logger.log({ type: "completed", message: `${results.length} result${results.length === 1 ? "" : "s"}` });

results.forEach((result, index) => {
	const snippet = result.body.replace(/\s+/g, " ").trim().slice(0, 200);
	logger.log({
		message: ["", `${index + 1}. ${result.title}  ·  score ${result.score}`, `   ${result.url}`, `   ${snippet}…`].join("\n"),
	});
});
