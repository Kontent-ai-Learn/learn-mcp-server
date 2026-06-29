import { defineConfig } from "vitest/config";

export default defineConfig({
	root: ".",
	test: {
		dir: "tests/integration",
		globals: true,
		environment: "node",
		// Force the sample-data fallback and a dedicated DB so tests never hit the live
		// endpoint or the production db/learn.db.
		env: { CONTENT_URL: "", DB_PATH: "db/learn-test.db" },
	},
	build: {
		target: "esnext",
	},
});
