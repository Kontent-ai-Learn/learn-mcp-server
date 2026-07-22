import { defineConfig } from "vitest/config";

export default defineConfig({
	root: ".",
	test: {
		dir: "tests/integration",
		globals: true,
		environment: "node",
		env: { DbPath: "data/search-records-vector-test.db" },
	},
	build: {
		target: "esnext",
	},
});
