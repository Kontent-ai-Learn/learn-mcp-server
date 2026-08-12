import { getApiReferenceEndpointsFromCache } from "../lib/content/api-reference-endpoints.js";
import { findDetailsBySearch } from "../lib/tools/shared/find-details-by-search.js";
import { logger } from "../lib/utils/logger.js";

const text = "list content items";

logger.log({ message: `Simulating get-endpoint-details for: "${text}"`, type: "process" });

const result = await findDetailsBySearch({
	getRecordsFromCache: getApiReferenceEndpointsFromCache,
	label: "endpoint",
	text,
	type: "endpoint",
});

logger.log({ message: JSON.stringify(result, undefined, 2), type: "completed" });
