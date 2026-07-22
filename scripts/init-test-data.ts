import { cleanData, initializeAll } from "../lib/initialization/initialization.js";

process.env.IsTest = "true";

await cleanData({ isTest: true });
await initializeAll({ isTest: true });
