import { getEndpointDetails } from "../lib/public-api.js";
import { logger } from "../lib/utils/logger.js";

const text = "list content items";

logger.log({ message: `Simulating get-endpoint-details for: "${text}"`, type: "process" });

const result = await getEndpointDetails(text);

logger.log({ message: JSON.stringify(result, undefined, 2), type: "completed" });
