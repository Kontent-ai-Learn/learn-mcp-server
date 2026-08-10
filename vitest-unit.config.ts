import { defineConfig } from "vitest/config";

export default defineConfig({
	build: {
		target: "esnext",
	},
	root: ".",
	test: {
		dir: "tests/unit",
		env: { IsTest: "true" },
		environment: "node",
		globals: true,
	},
});
