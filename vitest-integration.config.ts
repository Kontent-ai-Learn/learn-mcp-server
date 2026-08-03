import { defineConfig } from "vitest/config";

export default defineConfig({
	build: {
		target: "esnext",
	},
	root: ".",
	test: {
		dir: "tests/integration",
		env: { IsTest: "true" },
		environment: "node",
		// Integration specs share a single on-disk test DB; run files serially to avoid contention.
		fileParallelism: false,
		globals: true,
	},
});
