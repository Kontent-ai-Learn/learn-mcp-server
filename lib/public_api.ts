/** biome-ignore-all lint/performance/noBarrelFile: Fine for public API */

export type { MatchType, SearchResult, SourceDoc } from "./indexing/schema.js";
export { ensureIndexReady, search } from "./indexing/service.js";
export { createServer } from "./server.js";
export { allTools } from "./tools/index.js";
