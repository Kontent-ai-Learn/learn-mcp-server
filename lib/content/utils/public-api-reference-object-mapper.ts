import type { ApiReferenceObject } from "../models/api-reference-objects.models.js";
import type { PublicApiReferenceObject } from "../models/public-api-reference-objects.models.js";

export function mapRecordToPublicApiReferenceObject(record: ApiReferenceObject, score: number): PublicApiReferenceObject {
	return {
		relevanceScore: score,
		docsUrl: record.url,
		description: record.markdownContent,
		apiReference: record.apiReference,
		properties: record.properties,
	};
}
