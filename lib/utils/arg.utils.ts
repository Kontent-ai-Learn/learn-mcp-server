export const transportTypes = ["stdio", "shttp"] as const;

export type TransportType = (typeof transportTypes)[number];

export function getTransportTypeFromArg(arg: string | undefined): TransportType | undefined {
	const normalized = arg?.toLowerCase();
	return transportTypes.find((type) => type === normalized);
}

export function hasTestFlag(argv: readonly string[]): boolean {
	return argv.includes("--test");
}

export function setTestEnv(): void {
	process.env.IsTest = "true";
}
