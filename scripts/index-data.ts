import path from "node:path";
import { deleteFolderRecursive } from "@kontent-ai/core-sdk/devkit";
import { ensureIndexReady } from "../lib/public_api.js";
import { getEnvConfig } from "../lib/utils/environment.utils.js";

deleteFolderRecursive(path.dirname(getEnvConfig().dbPath));
await ensureIndexReady();
