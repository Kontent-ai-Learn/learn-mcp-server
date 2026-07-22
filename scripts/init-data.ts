import { cleanData, initializeAll } from "../lib/initialization/initialization.js";

await cleanData({ isTest: false });
await initializeAll({ isTest: false });
