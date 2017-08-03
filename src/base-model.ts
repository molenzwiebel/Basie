/**
 * Represents a wrapped constructor of a model, which is essentially
 * just the constructor with some merged definitions that add static methods.
 */
import QueryBuilder from "./query/builder";
import { getForeignKey } from "./util";

export type Wrapped<T, A> = T & {
    readonly tableName: string;
} & QueryBuilder<A>;

export type R<T> = QueryBuilder<T> & (() => Promise<T>);
export type A<T> = QueryBuilder<T> & (() => Promise<T[]>);

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

    /**
     * Indicates that this object has a single associated object of the provided
     * model type and optional foreign key (which will default to the name of the
     * current model with _id).
     */
    public hasOne<A, T extends Wrapped<any, A>>(model: T, foreignKey?: string): R<A> {
        let instance: Promise<A>;
        return <any>new Proxy(/* istanbul ignore next */ () => {}, {
            apply: () => {
                if (instance) return instance;
                return instance = model.where(foreignKey || getForeignKey(this.constructor.name), this.id).limit(1).first();
            },
            get: (obj: any, key) => {
                const builder: any = model.where(foreignKey || getForeignKey(this.constructor.name), this.id).limit(1);
                if (typeof builder[key] === "undefined") throw new Error("Invalid QueryBuilder member.");
                return typeof builder[key] === "function" ? builder[key].bind(builder) : builder[key];
            }
        });
    }

    /**
     * Indicates that this object has a single associated object of the provided
     * model type. The object will be looked up by looking at the value of the specified
     * column and finding the row of the specified model with that ID.
     */
    public belongsTo<A, T extends Wrapped<any, A>, K extends keyof this>(model: T, foreignKey?: K): R<A> {
        let instance: Promise<A>;
        return <any>new Proxy(/* istanbul ignore next */ () => {}, {
            apply: () => {
                if (instance) return instance;
                return instance = model.where("id", (<any>this)[foreignKey || getForeignKey(model.name)]).first();
            },
            get: (obj: any, key) => {
                const builder: any = model.where("id", (<any>this)[foreignKey || getForeignKey(model.name)]);
                if (typeof builder[key] === "undefined") throw new Error("Invalid QueryBuilder member.");
                return typeof builder[key] === "function" ? builder[key].bind(builder) : builder[key];
            }
        });
    }

    /**
     * Relationship that finds all members of the specified model table with their
     * foreign key set to the ID of the current object.
     */
    public hasMany<Q, T extends Wrapped<any, Q>>(model: T, foreignKey?: string): A<Q> {
        let instance: Promise<Q[]>;
        return <any>new Proxy(/* istanbul ignore next */ () => {}, {
            apply: () => {
                if (instance) return instance;
                return instance = model.where(foreignKey || getForeignKey(this.constructor.name), this.id).all();
            },
            get: (obj: any, key) => {
                const builder: any = model.where(foreignKey || getForeignKey(this.constructor.name), this.id);
                if (typeof builder[key] === "undefined") throw new Error("Invalid QueryBuilder member.");
                return typeof builder[key] === "function" ? builder[key].bind(builder) : builder[key];
            }
        });
    }
}