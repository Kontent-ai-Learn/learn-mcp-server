import { defineConfig } from "vitest/config";

export default defineConfig({
	root: ".",
	test: {
		dir: "tests/integration",
		globals: true,
		environment: "node",
		env: { IsTest: "true" },
		// Integration specs share a single on-disk test DB; run files serially to avoid contention.
		fileParallelism: false,
	},
	build: {
		target: "esnext",
	},
});
