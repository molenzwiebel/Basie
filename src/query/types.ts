import QueryBuilder from "./builder";
import { DatabaseType } from "../base-model";

export type Operator =
    "=" | "<" | ">" | "<=" | ">=" | "<>" | "!=" | "<=>" |
    "LIKE" | "LIKE BINARY" | "NOT LIKE" | "BETWEEN" | "ILIKE" |
    "&" | "|" | "^" | "<<" | ">>" |
    "RLIKE" | "REGEXP" | "NOT REGEXP" |
    "~" | "~*" | "!~" | "!~*" | "SIMILAR TO" |
    "NOT SIMILAR TO" | "NOT ILIKE" | "~~*" | "!~~*";

export type JoinType = "INNER" | "LEFT" | "RIGHT";
export type QueryBoolean = "AND" | "OR";
export type OrderDirection = "DESC" | "ASC";

export interface SimpleWhereClause {
    type: "basic";
    column: string;
    operator: Operator;
    value: DatabaseType;
    boolean: QueryBoolean;
}

export interface ColumnWhereClause {
    type: "column";
    first: string;
    operator: Operator;
    second: string;
    boolean: QueryBoolean;
}

export interface RawWhereClause {
    type: "raw";
    sql: string;
    values: DatabaseType[];
    boolean: QueryBoolean;
}

export interface NullWhereClause {
    type: "null";
    negate: boolean; // if true, NOT NULL else NULL
    column: string;
    boolean: QueryBoolean;
}

export interface NestedWhereClause {
    type: "nested";
    builder: QueryBuilder<any>;
    boolean: QueryBoolean;
}

export type WhereQueryClause = SimpleWhereClause | ColumnWhereClause | RawWhereClause | NullWhereClause | NestedWhereClause;