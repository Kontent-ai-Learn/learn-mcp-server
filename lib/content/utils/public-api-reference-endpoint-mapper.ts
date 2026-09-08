import type { ApiReferenceEndpoint } from "../models/api-reference-endpoints.models.js";
import type { PublicApiReferenceEndpoint } from "../models/public-api-reference-endpoints.models.js";

export function mapRecordToPublicApiReferenceEndpoint(record: ApiReferenceEndpoint, score: number): PublicApiReferenceEndpoint {
	return {
		score: score,
		docsUrl: record.url,
		description: record.markdownContent,
		apiReference: record.apiReference,
		bodyParameters: record.bodyParameters,
		queryParameters: record.queryParameters,
		endpointParameters: record.endpointParameters,
		endpointUrls: record.endpointUrls,
		headerParameters: record.headerParameters,
		httpMethod: record.httpMethod,
		responses: record.responses,
		tags: record.tags,
		title: record.title,
		usageCodeSamples: record.usageCodeSamples,
	};
}
