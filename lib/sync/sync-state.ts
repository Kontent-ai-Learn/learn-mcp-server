import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getSyncStatePath } from "../config.js";
import { type SyncState, syncStateSchema } from "./models/sync-state.models.js";

export function readSyncState(): SyncState | undefined {
	const filepath = getSyncStatePath();
	if (!existsSync(filepath)) {
		return undefined;
	}
	return syncStateSchema.parse(JSON.parse(readFileSync(filepath, "utf8")));
}

export function writeSyncState(state: SyncState): void {
	const filepath = getSyncStatePath();
	mkdirSync(dirname(filepath), { recursive: true });
	writeFileSync(filepath, JSON.stringify(state, undefined, 2));
}
