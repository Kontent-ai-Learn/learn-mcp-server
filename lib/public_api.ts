/** biome-ignore-all lint/performance/noBarrelFile: Fine for public API */

export { syncDatabase } from "./indexing/indexer.js";
export type { MatchType, SearchResult } from "./indexing/indexer.models.js";
export { search } from "./search/search.js";
export { createServer } from "./server.js";
export { allTools } from "./tools/index.js";
