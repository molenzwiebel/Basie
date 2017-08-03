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

    /**
     * Returns a new builder that contains a WHERE clause for the current id.
     */
    public builder(): QueryBuilder<this> {
        return QueryBuilder.table<any>(Object.getPrototypeOf(this).tableName).where("id", this.id);
    }

    /**
     * Saves this object, inserting it if it doesn't exist or updating it otherwise.
     */
    public save(): Promise<void> {
        // Insert
        if (typeof this.id === "undefined") {
            return this.builder().insertAndGetId(this).then(id => {
                (<any>this).id = id;
            });
        } else {
            return this.builder().update(this);
        }
    }

    /**
     * Deletes this object, throwing if it is not currently stored.
     */
    public delete(): Promise<void> {
        if (typeof this.id === "undefined") throw new Error("Cannot delete object if it is not in the database.");

        return this.builder().delete().then(x => {
            (<any>this).id = undefined;
        });
    }
}