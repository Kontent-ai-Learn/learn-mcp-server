import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
	readonly version: string;
	readonly [key: string]: unknown;
};

type ServerJson = {
	readonly version: string;
	readonly packages: ReadonlyArray<{
		readonly version: string;
		readonly [key: string]: unknown;
	}>;
	readonly [key: string]: unknown;
};

const readJsonFile = <T>(filePath: string): T => {
	const content = readFileSync(filePath, "utf-8");
	return JSON.parse(content) as T;
};

const getFiles = (): {
	packageJsonVersion: string;
	serverJson: ServerJson;
	updateServerJson: (serverJson: ServerJson) => void;
} => {
	const root = process.cwd();

	const packageJson = readJsonFile<PackageJson>(join(root, "package.json"));
	const serverJson = readJsonFile<ServerJson>(join(root, "server.json"));

	return {
		packageJsonVersion: packageJson.version,
		serverJson,
		updateServerJson: (serverJson: ServerJson) => {
			writeFileSync(join(root, "server.json"), JSON.stringify(serverJson, null, 2));
		},
	};
};

const areAllVersionsEqual = (
	targetVersion: string,
	versions: {
		serverJson: string;
		serverJsonPackages: ReadonlyArray<string>;
	},
): boolean => {
	const serverVersionMatches = versions.serverJson === targetVersion;
	const allPackageVersionsMatch = versions.serverJsonPackages.every((version) => version === targetVersion);

	return serverVersionMatches && allPackageVersionsMatch;
};

const syncVersions = (): void => {
	const { packageJsonVersion, serverJson, updateServerJson } = getFiles();

	const allVersionsMatch = areAllVersionsEqual(packageJsonVersion, {
		serverJson: serverJson.version,
		serverJsonPackages: serverJson.packages.map((pkg) => pkg.version),
	});

	if (allVersionsMatch) {
		console.log(`✅ Version is already up-to-date: ${packageJsonVersion}`);
		return;
	}

	const updatedServerJson = {
		...serverJson,
		version: packageJsonVersion,
		packages: serverJson.packages.map((pkg) => ({
			...pkg,
			version: packageJsonVersion,
		})),
	};

	updateServerJson(updatedServerJson);

	console.log(`✅ Synced server.json to version ${packageJsonVersion}`);
	console.log(`   Updated ${serverJson.packages.length} package(s)`);
};

try {
	syncVersions();
} catch (error) {
	console.error("❌ Error:", error instanceof Error ? error.message : error);
	process.exit(1);
}
