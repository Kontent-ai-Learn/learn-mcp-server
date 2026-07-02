import { defineConfig } from "vitest/config";

export default defineConfig({
	root: ".",
	test: {
		dir: "tests",
		globals: true,
		environment: "node",
		env: { DB_PATH: "db/learn-test.db" },
	},
	build: {
		target: "esnext",
	},
});
