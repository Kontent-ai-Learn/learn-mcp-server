import { cleanData, initializeAll } from "../lib/initialization/initialization.js";

await cleanData({ isTest: true });
await initializeAll({ isTest: true });
