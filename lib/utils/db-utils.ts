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

export type TableDefinition<TName extends string, TColumn extends string> = {
	readonly tableName: TName;
	readonly columns: Record<TColumn, ColumnDefinition>;
};

export type SqlWhere<TColumn extends string> =
	| { readonly column: TColumn; readonly operator: "="; readonly value: SqlValue }
	| { readonly column: TColumn; readonly operator: "IN"; readonly values: readonly SqlValue[] };

export type UpdateValue = SqlValue | { readonly expression: string; readonly params: readonly SqlValue[] };

/** Maps a column's SQL type to its TypeScript value type. */
type SqlColumnTsType<TSqlType extends string> = TSqlType extends "TEXT"
	? string
	: TSqlType extends "INTEGER" | "REAL"
		? number
		: TSqlType extends "BLOB" | `F32_BLOB(${string})` | `F8_BLOB(${string})`
			? Uint8Array
			: SqlValue;

/** A column's value type, made nullable unless it is NOT NULL or a primary key. */
type ColumnTsValue<TColumn extends ColumnDefinition> = TColumn extends { readonly notNull: true } | { readonly primaryKey: true }
	? SqlColumnTsType<TColumn["type"]>
	: SqlColumnTsType<TColumn["type"]> | null;

/** The row shape produced by selecting `TColumn` columns from `TDef`, keyed by column key. */
type SelectedRow<TDef extends TableDefinition<string, string>, TColumn extends keyof TDef["columns"]> = {
	readonly [Key in TColumn]: ColumnTsValue<TDef["columns"][Key]>;
};

export function buildCreateTableQuery<TName extends string, TColumn extends string>(definition: TableDefinition<TName, TColumn>): string {
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
export async function insertInto<TName extends string, TColumn extends string>(
	db: Database,
	{
		definition,
		values,
	}: { readonly definition: TableDefinition<TName, TColumn>; readonly values: Partial<Record<NoInfer<TColumn>, SqlValue>> },
): Promise<SqlRunResult> {
	const entries = Object.entries(values) as readonly [string, SqlValue][];
	const names = entries.map(([key]) => definition.columns[key as TColumn].name).join(", ");
	const placeholders = entries.map(() => "?").join(", ");
	const params = entries.map(([, value]) => value);
	return await db.run(`INSERT INTO ${definition.tableName} (${names}) VALUES (${placeholders})`, ...params);
}

/** Deletes rows matching `where`. `where` is required to avoid an accidental delete-all. */
export async function deleteFrom<TName extends string, TColumn extends string>(
	db: Database,
	{ definition, where }: { readonly definition: TableDefinition<TName, TColumn>; readonly where: SqlWhere<NoInfer<TColumn>> },
): Promise<SqlRunResult> {
	const { clause, params } = buildWhere(definition, where);
	return await db.run(`DELETE FROM ${definition.tableName}${clause}`, ...params);
}

export async function updateTable<TName extends string, TColumn extends string>(
	db: Database,
	{
		definition,
		set,
		where,
	}: {
		readonly definition: TableDefinition<TName, TColumn>;
		readonly set: Partial<Record<NoInfer<TColumn>, UpdateValue>>;
		readonly where: { readonly column: NoInfer<TColumn>; readonly value: SqlValue };
	},
): Promise<SqlRunResult> {
	const assignments = (Object.entries(set) as readonly [string, UpdateValue][]).map(([key, value]) => {
		const name = definition.columns[key as TColumn].name;
		return match(value)
			.with({ expression: P.string }, (expr) => ({ sql: `${name} = ${expr.expression}`, params: expr.params }))
			.otherwise((bound) => ({ sql: `${name} = ?`, params: [bound] as readonly SqlValue[] }));
	});
	const setClause = assignments.map((assignment) => assignment.sql).join(", ");
	const params = [...assignments.flatMap((assignment) => assignment.params), where.value];
	return await db.run(`UPDATE ${definition.tableName} SET ${setClause} WHERE ${definition.columns[where.column].name} = ?`, ...params);
}

export async function selectFrom<TDef extends TableDefinition<string, string>, TColumn extends keyof TDef["columns"] & string>(
	db: Database,
	{
		definition,
		columns,
		where,
	}: {
		readonly definition: TDef;
		readonly columns: readonly TColumn[];
		readonly where?: SqlWhere<keyof TDef["columns"] & string>;
	},
): Promise<readonly SelectedRow<TDef, TColumn>[]> {
	const projection = columns
		.map((key) => {
			const name = columnName(definition, key);
			return name === key ? name : `${name} AS ${key}`;
		})
		.join(", ");
	const { clause, params } = buildWhere(definition, where);
	const rows = await db.all(`SELECT ${projection} FROM ${definition.tableName}${clause}`, ...params);
	return rows as readonly SelectedRow<TDef, TColumn>[];
}

function columnName<TDef extends TableDefinition<string, string>>(definition: TDef, key: keyof TDef["columns"] & string): string {
	const column = definition.columns[key];
	if (column === undefined) {
		throw new Error(`Unknown column "${key}" on table "${definition.tableName}"`);
	}
	return column.name;
}

function buildWhere<TDef extends TableDefinition<string, string>>(
	definition: TDef,
	where: SqlWhere<keyof TDef["columns"] & string> | undefined,
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
