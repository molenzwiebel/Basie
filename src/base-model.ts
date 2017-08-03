/**
 * Represents a wrapped constructor of a model, which is essentially
 * just the constructor with some merged definitions that add static methods.
 */
import QueryBuilder from "./query/builder";

export type Wrapped<T, A> = T & {
    readonly tableName: string;
} & QueryBuilder<A>;

/**
 * Represents the types currently supported natively.
 */
export type DatabaseType = number | string | boolean;
export type KeyedDatabaseResult = { [key: string]: DatabaseType };

/**
 * Represents an abstract base model that every model inherits from.
 */
export default abstract class BaseModel {
    readonly id: number;
}