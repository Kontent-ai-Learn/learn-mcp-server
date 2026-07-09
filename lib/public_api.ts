/** biome-ignore-all lint/performance/noBarrelFile: Fine for public API */

export { syncDatabase } from "./indexing/indexer.js";
export type { MatchType, SearchResult, SourceDoc } from "./indexing/models.js";
export { search } from "./indexing/search.js";
export { createServer } from "./server.js";
export { allTools } from "./tools/index.js";
