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
    public remove(): Promise<void> {
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

function TODO(): never {
    throw new Error("TODO");
}