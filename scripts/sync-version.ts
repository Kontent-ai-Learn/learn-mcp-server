import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tryCatch } from "@kontent-ai/core-sdk";
import { getErrorMessage } from "../lib/utils/error.utils.js";
import { logger } from "../lib/utils/logger.js";

interface PackageJson {
	readonly version: string;
	readonly [key: string]: unknown;
}

interface ServerJson {
	readonly version: string;
	readonly packages: readonly {
		readonly version: string;
		readonly [key: string]: unknown;
	}[];
	readonly [key: string]: unknown;
}

const readJsonFile = <T>(filePath: string): T => {
	const content = readFileSync(filePath, "utf8");
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
		updateServerJson: (updatedServerJson: ServerJson) => {
			writeFileSync(join(root, "server.json"), JSON.stringify(updatedServerJson, undefined, 2));
		},
	};
};

const areAllVersionsEqual = (
	targetVersion: string,
	versions: {
		readonly serverJson: string;
		readonly serverJsonPackages: readonly string[];
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
		packages: serverJson.packages.map((pkg) => ({
			...pkg,
			version: packageJsonVersion,
		})),
		version: packageJsonVersion,
	};

	updateServerJson(updatedServerJson);

	console.log(`✅ Synced server.json to version ${packageJsonVersion}`);
	console.log(`   Updated ${serverJson.packages.length} package(s)`);
};

const { success, error } = tryCatch(() => {
	syncVersions();
	logger.log({ message: "Version synced successfully", type: "info" });
});

if (!success) {
	logger.log({ message: `Error syncing version: ${getErrorMessage(error)}`, type: "error" });
	process.exit(1);
}
