/**
 * Keys that occur more than once, in first-seen order.
 *
 * Indexing and the codename join both treat their key as unique — `replaceDocument` writes by `id`
 * and `getTopMatches` looks up by `codename` — so a repeated key silently drops or mismatches a
 * document rather than failing. This makes that visible.
 */
export function findDuplicateKeys<T>(items: readonly T[], keyOf: (item: T) => string): readonly string[] {
	const counts = items.reduce<Map<string, number>>((acc, item) => {
		const key = keyOf(item);
		return acc.set(key, (acc.get(key) ?? 0) + 1);
	}, new Map());

	return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}
