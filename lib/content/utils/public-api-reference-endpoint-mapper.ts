import type { ApiReferenceEndpoint } from "../models/api-reference-endpoints.models.js";

export type PublicApiReferenceEndpoint = Pick<
	ApiReferenceEndpoint,
	| "apiReference"
	| "bodyParameters"
	| "queryParameters"
	| "endpointParameters"
	| "endpointUrls"
	| "headerParameters"
	| "httpMethod"
	| "responses"
	| "tags"
	| "title"
	| "usageCodeSamples"
> & {
	readonly score: number;
	readonly docsUrl: string | undefined;
	readonly description: string;
};

export function mapRecordToPublicApiReferenceEndpoint(record: ApiReferenceEndpoint, score: number): PublicApiReferenceEndpoint {
	return {
		score,
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
