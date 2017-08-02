/**
 * Represents a wrapped constructor of a model, which is essentially
 * just the constructor with some merged definitions that add static methods.
 */
export type Wrapped<T> = T & {
    readonly tableName: string;
};

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