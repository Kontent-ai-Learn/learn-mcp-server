/** biome-ignore-all lint/performance/noBarrelFile: Fine for public API */

export type { MatchType, SearchResult, SourceDoc } from "./indexing/index.models.js";
export { search, syncDatabase } from "./indexing/search.js";
export { createServer } from "./server.js";
export { allTools } from "./tools/index.js";
