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

export type UpdateAssignment<TColumn extends string> = TColumn | { readonly column: TColumn; readonly value: string };

export type WhereCondition<TColumn extends string> =
	| { readonly column: TColumn; readonly operator: "=" }
	| { readonly column: TColumn; readonly operator: "IN"; readonly placeholderCount: number };

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

export function buildInsertQuery<TName extends string, TColumn extends string>(
	definition: TableDefinition<TName, TColumn>,
	columnKeys: readonly TColumn[],
): string {
	const names = columnKeys.map((key) => definition.columns[key].name).join(", ");
	const placeholders = columnKeys.map(() => "?").join(", ");
	return `INSERT INTO ${definition.tableName} (${names}) VALUES (${placeholders})`;
}

export function buildDeleteQuery<TName extends string, TColumn extends string>(
	definition: TableDefinition<TName, TColumn>,
	whereColumn: TColumn,
): string {
	return `DELETE FROM ${definition.tableName} WHERE ${definition.columns[whereColumn].name} = ?`;
}

export function buildUpdateQuery<TName extends string, TColumn extends string>({
	definition,
	update,
	whereColumn,
}: {
	readonly definition: TableDefinition<TName, TColumn>;
	readonly update: readonly UpdateAssignment<TColumn>[];
	readonly whereColumn: TColumn;
}): string {
	const setClause = update
		.map((assignment) => {
			const key = typeof assignment === "string" ? assignment : assignment.column;
			const value = typeof assignment === "string" ? "?" : assignment.value;
			return `${definition.columns[key].name} = ${value}`;
		})
		.join(", ");
	return `UPDATE ${definition.tableName} SET ${setClause} WHERE ${definition.columns[whereColumn].name} = ?`;
}

export function buildSelectQuery<TName extends string, TColumn extends string>({
	definition,
	columnKeys,
	where,
}: {
	readonly definition: TableDefinition<TName, TColumn>;
	readonly columnKeys: readonly TColumn[];
	readonly where?: WhereCondition<TColumn>;
}): string {
	const names = columnKeys.map((key) => definition.columns[key].name).join(", ");
	const select = `SELECT ${names} FROM ${definition.tableName}`;
	if (where === undefined) {
		return select;
	}
	const columnName = definition.columns[where.column].name;
	if (where.operator === "=") {
		return `${select} WHERE ${columnName} = ?`;
	}
	const placeholders = Array.from({ length: where.placeholderCount }, () => "?").join(", ");
	return `${select} WHERE ${columnName} IN (${placeholders})`;
}
