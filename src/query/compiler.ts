import QueryBuilder from "./builder";
import { ColumnWhereClause, NullWhereClause, RawWhereClause, SimpleWhereClause, NestedWhereClause } from "./types";
import { DatabaseType } from "../base-model";

export type Builder = QueryBuilder<any>;
export type QueryComponent = { sql: string, args: DatabaseType[] };

/**
 * This class is responsible for "compiling" QueryBuilders into the raw SQL
 * that will be executed by the database engine. It returns both SQL and bound
 * values, so we can safely let the database engine handle escaping of arguments.
 */
export default class SQLGrammarCompiler {
    /**
     * Compiles a full SELECT query.
     */
    compileSelect(builder: Builder): QueryComponent {
        const components: { [key: string]: QueryComponent } = this.compileComponents(builder);

        return {
            sql: Object.keys(components).map(x => components[x].sql).filter(x => !!x).join(" "),
            args: Object.keys(components).map(x => components[x].args).reduce((p, c) => [...p, ...c], [])
        };
    }

    /**
     * Compiles all components of a normal SELECT query. This can be overridden by subclasses
     * to reorder this or to add/remove components.
     */
    protected compileComponents(builder: Builder) {
        return {
            aggregate: this.compileAggregate(builder),
            columns: this.compileColumns(builder),
            from: this.compileFrom(builder),
            joins: this.compileJoins(builder),
            wheres: this.compileWheres(builder),
            groups: this.compileGroups(builder),
            orders: this.compileOrders(builder),
            limit: this.compileLimit(builder)
        };
    }

    /**
     * Compiles the aggregate function part of a SELECT query.
     */
    compileAggregate(builder: Builder): QueryComponent {
        if (!builder.aggregateFunction) return  { sql: "", args: [] };

        const columns = builder.columns.map(x => this.escapeColumn(x)).join(", ");
        return {
            sql: `SELECT ${builder.aggregateFunction}(${builder.isDistinct && columns !== "*" ? "DISTINCT " : ""}${columns}) AS aggregate`,
            args: []
        };
    }

    /**
     * Compiles the SELECT `columns` part of a SELECT query, unless
     * an aggregate function was specified.
     */
    compileColumns(builder: Builder): QueryComponent {
        // We will let aggregate start the query if its present.
        if (builder.aggregateFunction) return  { sql: "", args: [] };

        return {
            sql: (builder.isDistinct ? "SELECT DISTINCT " : "SELECT ") + builder.columns.map(c => this.escapeColumn(c)).join(", "),
            args: []
        };
    }

    /**
     * Compiles the FROM `table` part of a SELECT query.
     */
    compileFrom(builder: Builder): QueryComponent {
        return {
            sql: "FROM " + this.escapeTable(builder.table),
            args: []
        };
    }

    /**
     * Compiles all JOIN conditions of the query.
     */
    compileJoins(builder: Builder): QueryComponent {
        const parts = builder.joins.map(join => {
            const condition = this.compileConditions(join);
            return {
                sql: `${join.type} JOIN ${this.escapeTable(join.joiningOn)} ON ${condition.sql}`,
                args: condition.args
            };
        });

        return {
            sql: parts.map(x => x.sql).join(" "),
            args: parts.map(x => x.args).reduce((p, c) => [...p, ...c], [])
        };
    }

    /**
     * Compiles all WHERE clauses of the query.
     */
    compileWheres(builder: Builder): QueryComponent {
        if (!builder.wheres.length) return  { sql: "", args: [] };

        const part = this.compileConditions(builder);
        return {
            sql: "WHERE " + part.sql,
            args: part.args
        };
    }

    /**
     * Compiles the set of WHERE conditions in the specified query. Used
     * for both JOIN and WHERE compiling.
     */
    compileConditions(builder: Builder): QueryComponent {
        if (!builder.wheres.length) return  { sql: "", args: [] };

        const parts = builder.wheres.map((where, i) => {
            let content;
            if (where.type === "basic") content = this.compileBasicWhere(builder, where);
            else if (where.type === "column") content = this.compileColumnWhere(builder, where);
            else if (where.type === "raw") content = this.compileRawWhere(builder, where);
            else if (where.type === "null") content = this.compileNullWhere(builder, where);
            else if (where.type === "nested") content = this.compileNestedWhere(builder, where);
            else throw new Error("Invalid type for where clause.");

            return {
                sql: (i === 0 ? "" : where.boolean + " ") + content.sql,
                args: content.args
            };
        });

        return {
            sql: parts.map(x => x.sql).join(" "),
            args: parts.map(x => x.args).reduce((p, c) => [...p, ...c], [])
        };
    }

    /**
     * Compiles a simple WHERE clause.
     */
    compileBasicWhere(builder: Builder, where: SimpleWhereClause): QueryComponent {
        return {
            sql: `${this.escapeColumn(where.column)} ${where.operator} ?`,
            args: [where.value]
        };
    }

    /**
     * Compiles a WHERE clause comparing two columns.
     */
    compileColumnWhere(builder: Builder, where: ColumnWhereClause): QueryComponent {
        return {
            sql: `${this.escapeColumn(where.first)} ${where.operator} ${this.escapeColumn(where.second)}`,
            args: []
        };
    }

    /**
     * Compiles a raw SQL where clause.
     */
    compileRawWhere(builder: Builder, where: RawWhereClause): QueryComponent {
        return {
            sql: where.sql,
            args: where.values
        };
    }

    /**
     * Compiles a WHERE clause checking for (NOT) NULL.
     */
    compileNullWhere(builder: Builder, where: NullWhereClause): QueryComponent {
        return {
            sql: this.escapeColumn(where.column) + " IS " + (where.negate ? "NOT " : "") + "NULL",
            args: []
        };
    }

    /**
     * Compiles a nested WHERE clause.
     */
    compileNestedWhere(builder: Builder, where: NestedWhereClause): QueryComponent {
        const ret = this.compileConditions(where.builder);

        return {
            sql: "(" + ret.sql + ")",
            args: ret.args
        };
    }

    /**
     * Compiles the GROUP BY clauses of the query.
     */
    compileGroups(builder: Builder): QueryComponent {
        if (!builder.groups.length) return  { sql: "", args: [] };
        return {
            sql: "GROUP BY " + builder.groups.map(x => this.escapeColumn(x)).join(", "),
            args: []
        };
    }

    /**
     * Compile the ORDER BY clauses of the query.
     */
    compileOrders(builder: Builder): QueryComponent {
        if (!builder.orders.length) return  { sql: "", args: [] };

        return {
            sql: "ORDER BY " + builder.orders.map(x => this.escapeColumn(x.column) + " " + x.direction).join(", "),
            args: []
        };
    }

    /**
     * Compiles the LIMIT part of the query.
     */
    compileLimit(builder: Builder): QueryComponent {
        if (builder.limitCount === -1) return  { sql: "", args: [] };

        return {
            sql: "LIMIT ?",
            args: [builder.limitCount]
        };
    }

    /**
     * Compiles a full INSERT query for the specified values. This accepts either a model
     * or a keyed database value object. This assumes that every element in the `values`
     * array has the same structure, and that it is not an empty array.
     */
    compileInsert<T extends object>(builder: QueryBuilder<T>, values: T[]): QueryComponent {
        const keys = Object.keys(values[0]).filter(x => typeof (<any>values[0])[x] !== "function");
        const columns = keys.map(x => this.escapeColumn(x)).join(",");

        const args = values.map(x => keys.map(k => (<any>x)[k])).reduce((p, c) => [...p, ...c], []);
        const placeholders = values.map(x => "(" + keys.map(k => "?").join(",") + ")").join(", ");

        return {
            sql: `INSERT INTO ${this.escapeTable(builder.table)} (${columns}) VALUES ${placeholders}`,
            args
        };
    }

    /**
     * Compiles a full UPDATE query for the specified partial. This does not diff-check and
     * simply assumes that everything specified needs to be updated.
     */
    compileUpdate<T extends object>(builder: QueryBuilder<T>, value: Partial<T>): QueryComponent {
        const columns = Object.keys(value).map(x => x + " = ?").join(", ");
        const args = Object.keys(value).map(x => <DatabaseType>value[x]);

        const joins = this.compileJoins(builder);
        const wheres = this.compileWheres(builder);

        return {
            sql: `UPDATE ${this.escapeTable(builder.table)}${joins.sql} SET ${columns} ${wheres.sql}`,
            args: [...joins.args, ...args, ...wheres.args]
        };
    }

    /**
     * Compiles a full DELETE query for all rows matching the builder's where clauses.
     */
    compileDelete(builder: Builder): QueryComponent {
        const wheres = this.compileWheres(builder);

        return {
            sql: `DELETE FROM ${this.escapeTable(builder.table)} ${wheres.sql}`,
            args: wheres.args
        };
    }

    /**
     * Escapes the specified column name. This is intended to be overridden by potential subclasses.
     */
    protected escapeColumn(column: string) {
        return column;
    }

    /**
     * Escapes the specified table name. This is intended to be overridden by potential subclasses.
     */
    protected escapeTable(table: string) {
        return table;
    }
}