import { match } from "ts-pattern";

export const transportTypes = ["stdio", "shttp"] as const;

export type TransportType = (typeof transportTypes)[number];

export function getTransportTypeFromArg(arg: string | undefined): TransportType | undefined {
	return match(arg?.toLowerCase())
		.returnType<TransportType | undefined>()
		.with("stdio" satisfies TransportType, () => "stdio")
		.with("shttp" satisfies TransportType, () => "shttp")
		.otherwise(() => {
			return undefined;
		});
}
