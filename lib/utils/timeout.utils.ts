import type { Duration } from "luxon";

export type WithTimeoutResult<T> = { readonly kind: "resolved"; readonly value: T } | { readonly kind: "timedOut" };

export async function withTimeout<T>(promise: Promise<T>, timeout: Duration): Promise<WithTimeoutResult<T>> {
	const timerHandle: { current?: NodeJS.Timeout } = {};
	const timedOut = new Promise<WithTimeoutResult<T>>((resolve) => {
		timerHandle.current = setTimeout(() => {
			resolve({ kind: "timedOut" });
		}, timeout.as("milliseconds"));
	});
	const resolved = promise.then((value): WithTimeoutResult<T> => ({ kind: "resolved", value }));

	try {
		return await Promise.race([resolved, timedOut]);
	} finally {
		clearTimeout(timerHandle.current);
	}
}

/**
 * Yields control back to Node's event loop via a real macrotask boundary. Some "async" native
 * bindings (e.g. Turso's Node build) are synchronous under the hood and never yield on their
 * own — a plain `await` on them never lets pending timers or new inbound connections run.
 *
 * If not used, the timeout used in Sync route will not work correctly because Turso calls
 * will never release the current thread.
 */
export async function yieldToEventLoop(): Promise<void> {
	await new Promise((resolve) => {
		setImmediate(resolve);
	});
}
