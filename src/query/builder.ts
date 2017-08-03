import { JoinType, Operator, OrderDirection, QueryBoolean, WhereQueryClause } from "./types";
import { DatabaseType, KeyedDatabaseResult, Wrapped } from "../base-model";

/**
 * A fluid SQL query builder that is semi-typesafe and supports selecting, inserting, updating
 * and deleting. Obtain an instance using the static methods or one of the methods on wrapped
 * models.
 */
export default class QueryBuilder<T> {
    /**
     * The prototype of the model we are currently querying. If this is non-null,
     * we are still operating on the full model (no narrowed down views) which means
     * that once we have fetched the objects we can assign this prototype to ensure that
     * the returned instance supports any user-defined methods (along with defaults such as save).
     */
    modelPrototype: any | null;

    /**
     * The aggregate function for this query. If this is set, it is assumed
     * that this query selects of format `SELECT fun(columns) AS aggregate`.
     */
    aggregateFunction: string | null = null;

    /**
     * Which table we are currently querying.
     */
    table: string;

    /**
     * The columns we are currently retrieving.
     */
    columns: string[] = ["*"];

    /**
     * If we are only looking for distinct values.
     */
    isDistinct = false;

    /**
     * All joins for the current query.
     */
    joins: JoinClause[] = [];

    /**
     * All where clauses for the current query.
     */
    wheres: WhereQueryClause[] = [];

    /**
     * All the GROUP BY columns for the query.
     */
    groups: string[] = [];

    /**
     * All the ORDER BY clauses for the query.
     */
    orders: { column: string, direction: OrderDirection }[] = [];

    /**
     * The LIMIT clause for the query, or -1 if not applicable.
     */
    limitCount = -1;

    /**
     * Narrows this query down to the specified fields. This erases type-
     * safety since raw SQL queries can be used. Do not use with untrusted input.
     */
    public select(...fields: string[]): QueryBuilder<KeyedDatabaseResult> {
        this.columns = fields;
        this.modelPrototype = null;
        return <any>this;
    }

    /**
     * Marks this query as looking for distinct values. Use distinct(false) to undo.
     */
    public distinct(value: boolean = true): this {
        this.isDistinct = value;
        return this;
    }

    /**
     * Changes the table this query is currently acting on to the table associated
     * with the specified model.
     */
    public from<M extends Wrapped<any>>(model: M): QueryBuilder<M>;

    /**
     * Changes the table this query is currently acting on to the specified table.
     * An optional type parameter can be used to set the scheme of the table so that
     * further operations are as type-safe as possible.
     */
    public from<M>(table: string): QueryBuilder<M>;

    public from<M>(modelOrTable: M | string): QueryBuilder<M> {
        if (typeof modelOrTable === "string") {
            this.table = modelOrTable;
            return <any>this;
        }

        this.table = (<any>modelOrTable).tableName;
        this.modelPrototype = (<any>modelOrTable).prototype;
        this.columns = ["*"];
        return <any>this;
    }

    /**
     * Creates a new nested where clause. The specified callback receives a nested
     * query builder that can be used to build the nested queries.
     */
    public where(handler: (builder: this) => any): this;

    /**
     * Adds a new where clause for the specified column, requiring that it matches
     * the specified variable. This is an alias for where(column, "=", value).
     */
    public where<K extends keyof T>(column: K, value: T[K]): this;

    /**
     * Adds a new where clause for the specified column, operator and value. Optionally
     * you can provide a QueryBoolean of "OR" instead of "AND", but it is recommended that
     * you use `orWhere` instead.
     */
    public where<K extends keyof T>(column: K, operator: Operator, value: T[K], boolean?: QueryBoolean): this;

    public where<K extends keyof T>(column: K | ((builder: this) => any), operatorOrValue?: Operator | T[K], value?: T[K], boolean: QueryBoolean = "AND") {
        if (typeof column === "function") {
            return this.whereNested(column, boolean);
        }

        if (typeof value === "undefined") {
            value = <any>operatorOrValue;
            operatorOrValue = "=";
        }

        this.wheres.push({ type: "basic", column, operator: <Operator>operatorOrValue, value: <DatabaseType><any>value, boolean });
        return this;
    }

    /**
     * Creates a new nested WHERE OR clause. The specified callback receives a nested
     * query builder that can be used to build the nested queries.
     */
    public orWhere(handler: (builder: this) => any): this;

    /**
     * Adds a new WHERE OR clause for the specified column, requiring that it matches
     * the specified variable. This is an alias for where(column, "=", value).
     */
    public orWhere<K extends keyof T>(column: K, value: T[K]): this;

    /**
     * Adds a new WHERE OR clause for the specified column, operator and value. Use
     * `where` if you want to add a WHERE AND clause instead.
     */
    public orWhere<K extends keyof T>(column: K, operator: Operator, value: T[K]): this;

    public orWhere<K extends keyof T>(column: K | ((builder: this) => any), operatorOrValue?: Operator | T[K], value?: T[K]) {
        return (<any>this.where)(column, operatorOrValue, value, "OR");
    }

    /**
     * Adds a new where clause comparing two columns of the current query. This uses
     * AND as boolean by default, use `orWhereColumn` if you want OR instead.
     */
    public whereColumn<K1 extends keyof T, K2 extends keyof T>(first: K1, operator: Operator, second: K2, boolean: QueryBoolean = "AND") {
        this.wheres.push({
            type: "column",
            first,
            operator,
            second,
            boolean
        });
        return this;
    }

    /**
     * Adds a new WHERE OR clause comparing two columns of the current query. This uses
     * OR, use `whereColumn` if you want AND instead.
     */
    public orWhereColumn<K1 extends keyof T, K2 extends keyof T>(first: K1, operator: Operator, second: K2) {
        return this.whereColumn(first, operator, second, "OR");
    }

    /**
     * Adds a new raw where clause for the current query. You can use ? as a substitute for arguments
     * to securely bind parameters.
     */
    public whereRaw(query: string, args: DatabaseType[], boolean: QueryBoolean = "AND"): this {
        this.wheres.push({
            type: "raw",
            sql: query,
            values: args,
            boolean
        });

        return this;
    }

    /**
     * Adds a new raw WHERE OR clause for the current query. You can use ? as a substitute for arguments
     * to securely bind parameters.
     */
    public orWhereRaw(query: string, args: DatabaseType[]): this {
        return this.whereRaw(query, args, "OR");
    }

    /**
     * Adds a new where clause asserting that the specified column is NULL.
     */
    public whereNull<K extends keyof T>(column: K, boolean: QueryBoolean = "AND", negate = false): this {
        this.wheres.push({
            type: "null",
            column,
            boolean,
            negate
        });
        return this;
    }

    /**
     * Adds a new WHERE OR clause asserting that the specified column is NULL.
     */
    public orWhereNull<K extends keyof T>(column: K): this {
        return this.whereNull(column, "OR");
    }

    /**
     * Adds a new where clause asserting that the specified column is NOT NULL.
     */
    public whereNotNull<K extends keyof T>(column: K): this {
        return this.whereNull(column, "AND", true);
    }

    /**
     * Adds a new WHERE OR clause asserting that the specified column is NOT NULL.
     */
    public orWhereNotNull<K extends keyof T>(column: K): this {
        return this.whereNull(column, "OR", true);
    }

    /**
     * Adds a new nested where query. The handler receives a new QueryBuilder that
     * can be used to enter the where clauses of the nested where.
     */
    public whereNested(handler: (builder: QueryBuilder<T>) => void, boolean: QueryBoolean = "AND") {
        const builder = this.createNew().from<T>(this.table);
        handler(builder);

        this.wheres.push({
            type: "nested",
            builder,
            boolean
        });
        return this;
    }

    /**
     * Adds a new nested WHERE OR query. The handler receives a new QueryBuilder that
     * can be used to enter the where clauses of the nested where.
     */
    public orWhereNested(handler: (builder: QueryBuilder<T>) => void) {
        return this.whereNested(handler, "OR");
    }

    /**
     * Adds a new INNER JOIN with the specified table on the specified columns and operators.
     * This operation loses type-safety since it is impossible to determine the return type
     * of the join statically.
     */
    public join(table: string, first: string, operator: Operator, second: string, type?: JoinType): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new nested INNER JOIN with the specified table. The handler receives a JoinClause
     * which it can use to build the new join.
     */
    public join(table: string, handler: (clause: JoinClause) => any): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new INNER JOIN with the specified model and the specified columns and operator.
     * This operation is type safe and returns a union of the current fields and the fields of
     * the specified model.
     */
    public join<M extends Wrapped<any>>(model: M, first: string, operator: Operator, second: string, type?: JoinType): QueryBuilder<T & M>;

    /**
     * Adds a new nested INNER JOIN with the specified model. The handler receives a JoinClause
     * which it can use to build the new join. This operation is type safe and returns a union
     * of the current fields and the fields of the specified model.
     */
    public join<M extends Wrapped<any>>(model: M, handler: (clause: JoinClause) => any): QueryBuilder<T & M>;

    public join<M>(tableOrModel: string | M, first: string | ((clause: JoinClause) => any), operator?: Operator, second?: string, type: JoinType = "INNER") {
        this.modelPrototype = null;

        const table = typeof tableOrModel === "string" ? tableOrModel : (<any>tableOrModel).tableName;
        const clause = new JoinClause(type, table);

        if (typeof first === "function") {
            first(clause);
        } else {
            clause.on(first, operator!, second!);
        }

        this.joins.push(clause);
        return <any>this;
    }

    /**
     * Adds a new LEFT JOIN with the specified table on the specified columns and operators.
     * This operation loses type-safety since it is impossible to determine the return type
     * of the join statically.
     */
    public leftJoin(table: string, first: string, operator: Operator, second: string): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new nested LEFT JOIN with the specified table. The handler receives a JoinClause
     * which it can use to build the new join.
     */
    public leftJoin(table: string, handler: (clause: JoinClause) => any): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new LEFT JOIN with the specified model and the specified columns and operator.
     * This operation is type safe and returns a union of the current fields and the fields of
     * the specified model.
     */
    public leftJoin<M extends Wrapped<any>>(model: M, first: string, operator: Operator, second: string): QueryBuilder<T & M>;

    /**
     * Adds a new nested LEFT JOIN with the specified model. The handler receives a JoinClause
     * which it can use to build the new join. This operation is type safe and returns a union
     * of the current fields and the fields of the specified model.
     */
    public leftJoin<M extends Wrapped<any>>(model: M, handler: (clause: JoinClause) => any): QueryBuilder<T & M>;

    public leftJoin<M>(tableOrModel: string | M, first: string | ((clause: JoinClause) => any), operator?: Operator, second?: string) {
        return (<any>this.join)(tableOrModel, first, operator, second, "LEFT");
    }

    /**
     * Adds a new RIGHT JOIN with the specified table on the specified columns and operators.
     * This operation loses type-safety since it is impossible to determine the return type
     * of the join statically.
     */
    public rightJoin(table: string, first: string, operator: Operator, second: string): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new nested RIGHT JOIN with the specified table. The handler receives a JoinClause
     * which it can use to build the new join.
     */
    public rightJoin(table: string, handler: (clause: JoinClause) => any): QueryBuilder<KeyedDatabaseResult>;

    /**
     * Adds a new RIGHT JOIN with the specified model and the specified columns and operator.
     * This operation is type safe and returns a union of the current fields and the fields of
     * the specified model.
     */
    public rightJoin<M extends Wrapped<any>>(model: M, first: string, operator: Operator, second: string): QueryBuilder<T & M>;

    /**
     * Adds a new nested RIGHT JOIN with the specified model. The handler receives a JoinClause
     * which it can use to build the new join. This operation is type safe and returns a union
     * of the current fields and the fields of the specified model.
     */
    public rightJoin<M extends Wrapped<any>>(model: M, handler: (clause: JoinClause) => any): QueryBuilder<T & M>;

    public rightJoin<M>(tableOrModel: string | M, first: string | ((clause: JoinClause) => any), operator?: Operator, second?: string) {
        return (<any>this.join)(tableOrModel, first, operator, second, "RIGHT");
    }

    /**
     * Marks the query to group the results by the provided column names.
     */
    public groupBy<K extends keyof T>(...groups: K[]) {
        this.groups = [...groups, ...this.groups].filter((e, i, a) => a.indexOf(e) === i);
        return this;
    }

    /**
     * Marks the query to order the results by the specified column in the specified
     * direction, or ASC (ascending) by default.
     */
    public orderBy<K extends keyof T>(column: K, direction: OrderDirection = "ASC") {
        this.orders.push({ column, direction });
        return this;
    }

    /**
     * Marks the query to order the results by the specified column in ascending direction.
     */
    public orderByAsc<K extends keyof T>(column: K) {
        return this.orderBy(column, "ASC");
    }

    /**
     * Marks the query to order the results by the specified column in descending direction.
     */
    public orderByDesc<K extends keyof T>(column: K) {
        return this.orderBy(column, "DESC");
    }

    /**
     * Limits the amount of rows this query targets to the specified amount. Must be positive non-null.
     */
    public limit(count: number) {
        if (count < 1) throw new Error("limit() expects a positive integer.");
        this.limitCount = count;
        return this;
    }

    /**
     * Returns the specified column of the first result returned by this query.
     */
    public value<K extends keyof T>(column: K): Promise<T[K]> {
        return TODO();
    }

    /**
     * Returns all rows matching the current query.
     */
    public get(): Promise<T[]> {
        return TODO();
    }

    /**
     * Returns only the specified column of all rows this query currently targets.
     */
    public pluck<K extends keyof T>(column: K): Promise<T[K][]> {
        return TODO();
    }

    /**
     * Checks if any rows exist that match the current query. Alias for count > 0.
     */
    public async exists(): Promise<boolean> {
        return await this.count() > 0;
    }

    /**
     * Counts the amount of rows matching.
     */
    public count(): Promise<number> {
        this.aggregateFunction = "COUNT";
        return TODO();
    }

    /**
     * Returns the average of the specified column, or the current column by default.
     */
    public avg(column?: string): Promise<number> {
        this.columns = column ? [column] : this.columns;
        this.aggregateFunction = "AVG";
        return TODO();
    }

    /**
     * Returns the sum of the specified column, or the current column by default.
     */
    public sum(column?: string): Promise<number> {
        this.columns = column ? [column] : this.columns;
        this.aggregateFunction = "SUM";
        return TODO();
    }

    /**
     * Returns the minimum value of the specified column, or the current column by default.
     */
    public min(column?: string): Promise<number> {
        this.columns = column ? [column] : this.columns;
        this.aggregateFunction = "MIN";
        return TODO();
    }

    /**
     * Returns the maximum value of the specified column, or the current column by default.
     */
    public max(column?: string): Promise<number> {
        this.columns = column ? [column] : this.columns;
        this.aggregateFunction = "MAX";
        return TODO();
    }

    /**
     * Inserts the specified entries in the current table.
     */
    public insert(entries: T[]): Promise<void> {
        return TODO();
    }

    /**
     * Updates the specified values for all rows matching the current query.
     */
    public update(values: Partial<T>): Promise<void> {
        return TODO();
    }

    /**
     * Deletes all rows matching the current query.
     */
    public delete(): Promise<void> {
        return TODO();
    }

    /**
     * Used as a helper function to create a new instance of ourselves. Mainly
     * used in nested where/on clauses. Must be overridden by subclasses.
     */
    protected createNew(): this {
        return <this>new QueryBuilder<T>();
    }
}

// This needs to be here (below QueryBuilder) to prevent a cyclic dependency.
import JoinClause from "./join-clause";

function TODO(): never {
    throw new Error("TODO");
}