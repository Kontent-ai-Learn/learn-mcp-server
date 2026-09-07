import type { ApiReferenceObject } from "../models/api-reference-objects.models.js";

export type PublicApiReferenceObject = Pick<ApiReferenceObject, "apiReference" | "properties"> & {
	readonly score: number;
	readonly docsUrl: string | undefined;
	readonly description: string;
};

export function mapRecordToPublicApiReferenceObject(record: ApiReferenceObject, score: number): PublicApiReferenceObject {
	return {
		score,
		docsUrl: record.url,
		description: record.markdownContent,
		apiReference: record.apiReference,
		properties: record.properties,
	};
}
