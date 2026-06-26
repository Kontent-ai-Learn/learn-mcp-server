import type { Database } from "@tursodatabase/database";
import { match, P } from "ts-pattern";

export type SqlValue = string | number | bigint | null | Uint8Array;

export type SqlRunResult = { readonly changes: number; readonly lastInsertRowid: number };

export type ColumnDefinition = {
	readonly name: string;
	readonly type: string;
	readonly primaryKey?: boolean;
	readonly notNull?: boolean;
	readonly unique?: boolean;
};

/** A table keyed by its row type; `columns` holds one metadata entry per row field. */
export type TableDefinition<TName extends string, TRow> = {
	readonly tableName: TName;
	readonly columns: Record<keyof TRow & string, ColumnDefinition>;
};

export type SqlWhere<TColumn extends string> =
	| { readonly column: TColumn; readonly operator: "="; readonly value: SqlValue }
	| { readonly column: TColumn; readonly operator: "IN"; readonly values: readonly SqlValue[] };

export type UpdateValue = SqlValue | { readonly expression: string; readonly params: readonly SqlValue[] };

export function buildCreateTableQuery<TName extends string, TRow>(definition: TableDefinition<TName, TRow>): string {
	const columnDefs = Object.values<ColumnDefinition>(definition.columns)
		.map((col) => {
			const parts: string[] = [col.name, col.type];
			if (col.primaryKey) {
				parts.push("PRIMARY KEY");
			}
			if (col.notNull) {
				parts.push("NOT NULL");
			}
			if (col.unique) {
				parts.push("UNIQUE");
			}
			return parts.join(" ");
		})
		.join(", ");
	return `CREATE TABLE IF NOT EXISTS ${definition.tableName} (${columnDefs});`;
}

/** Inserts a row, binding the provided column values by name. Runs directly (no prepare). */
export async function insertInto<TName extends string, TRow>(
	db: Database,
	{
		definition,
		values,
	}: { readonly definition: TableDefinition<TName, TRow>; readonly values: Partial<Record<keyof TRow & string, SqlValue>> },
): Promise<SqlRunResult> {
	const entries = Object.entries(values) as readonly [string, SqlValue][];
	const names = entries.map(([key]) => columnName(definition, key as keyof TRow & string)).join(", ");
	const placeholders = entries.map(() => "?").join(", ");
	const params = entries.map(([, value]) => value);
	return await db.run(`INSERT INTO ${definition.tableName} (${names}) VALUES (${placeholders})`, ...params);
}

/** Deletes rows matching `where`. `where` is required to avoid an accidental delete-all. */
export async function deleteFrom<TName extends string, TRow>(
	db: Database,
	{ definition, where }: { readonly definition: TableDefinition<TName, TRow>; readonly where: SqlWhere<keyof TRow & string> },
): Promise<SqlRunResult> {
	const { clause, params } = buildWhere(definition, where);
	return await db.run(`DELETE FROM ${definition.tableName}${clause}`, ...params);
}

export async function updateTable<TName extends string, TRow>(
	db: Database,
	{
		definition,
		set,
		where,
	}: {
		readonly definition: TableDefinition<TName, TRow>;
		readonly set: Partial<Record<keyof TRow & string, UpdateValue>>;
		readonly where: { readonly column: keyof TRow & string; readonly value: SqlValue };
	},
): Promise<SqlRunResult> {
	const assignments = (Object.entries(set) as readonly [string, UpdateValue][]).map(([key, value]) => {
		const name = columnName(definition, key as keyof TRow & string);
		return match(value)
			.with({ expression: P.string }, (expr) => ({ sql: `${name} = ${expr.expression}`, params: expr.params }))
			.otherwise((bound) => ({ sql: `${name} = ?`, params: [bound] as readonly SqlValue[] }));
	});
	const setClause = assignments.map((assignment) => assignment.sql).join(", ");
	const params = [...assignments.flatMap((assignment) => assignment.params), where.value];
	return await db.run(`UPDATE ${definition.tableName} SET ${setClause} WHERE ${columnName(definition, where.column)} = ?`, ...params);
}

export async function selectFrom<TName extends string, TRow, TColumn extends keyof TRow & string>(
	db: Database,
	{
		definition,
		columns,
		where,
	}: {
		readonly definition: TableDefinition<TName, TRow>;
		readonly columns: readonly TColumn[];
		readonly where?: SqlWhere<keyof TRow & string>;
	},
): Promise<readonly Pick<TRow, TColumn>[]> {
	const projection = columns
		.map((key) => {
			const name = columnName(definition, key);
			return name === key ? name : `${name} AS ${key}`;
		})
		.join(", ");
	const { clause, params } = buildWhere(definition, where);
	const rows = await db.all(`SELECT ${projection} FROM ${definition.tableName}${clause}`, ...params);
	return rows as readonly Pick<TRow, TColumn>[];
}

function columnName<TName extends string, TRow>(definition: TableDefinition<TName, TRow>, key: keyof TRow & string): string {
	const column = definition.columns[key];
	if (column === undefined) {
		throw new Error(`Unknown column "${key}" on table "${definition.tableName}"`);
	}
	return column.name;
}

function buildWhere<TName extends string, TRow>(
	definition: TableDefinition<TName, TRow>,
	where: SqlWhere<keyof TRow & string> | undefined,
): { readonly clause: string; readonly params: readonly SqlValue[] } {
	if (where === undefined) {
		return { clause: "", params: [] };
	}
	const name = columnName(definition, where.column);
	return match(where)
		.with({ operator: "=" }, (condition) => ({ clause: ` WHERE ${name} = ?`, params: [condition.value] as readonly SqlValue[] }))
		.with({ operator: "IN" }, (condition) => ({
			clause: ` WHERE ${name} IN (${condition.values.map(() => "?").join(", ")})`,
			params: condition.values,
		}))
		.exhaustive();
}
