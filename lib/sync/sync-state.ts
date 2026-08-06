import { getSyncStatePath } from "../config.js";
import { existsSync, readFileSync, writeFileSync } from "../utils/file.utils.js";
import { type SyncState, syncStateSchema } from "./models/sync-state.models.js";

export function readSyncState(): SyncState | undefined {
	const filepath = getSyncStatePath();
	if (!existsSync(filepath)) {
		return undefined;
	}
	return syncStateSchema.parse(JSON.parse(readFileSync(filepath)));
}

export function writeSyncState(state: SyncState): void {
	const filepath = getSyncStatePath();
	writeFileSync(filepath, JSON.stringify(state, undefined, 2));
}
