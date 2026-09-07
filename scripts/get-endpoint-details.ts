import { mapRecordToPublicApiReferenceEndpoint } from "../lib/content/utils/public-api-reference-endpoint-mapper.js";
import { getEndpointDetails } from "../lib/public-api.js";
import { logger } from "../lib/utils/logger.js";

const text = "list content items";

logger.log({ message: `Simulating get-endpoint-details for: "${text}"`, type: "process" });

const result = await getEndpointDetails({
	text,
	apiReference: "delivery_api",
	mapRecordToPublicType: mapRecordToPublicApiReferenceEndpoint,
});

logger.log({ message: JSON.stringify(result, undefined, 2), type: "completed" });
