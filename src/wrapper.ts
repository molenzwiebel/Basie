import Database from "./database";
import {
    AbstractConstructor,
    B,
    Basie,
    BasieClassType,
    BasiePrototype,
    FieldMetadata,
    KeyedAnyObject
} from "./types";

/**
 * Creates a based class from the specified constructor class `<A>`. `A` should be an
 * abstract class that extends Basie, so that instance methods know of Basie's methods.
 * This function takes an optional table name, or the lowercase name of the wrapped 
 * component with by default. This function will use the metadata stored by {@link field}
 * and {@link children} to generate a subclass of `Base` that will add various static
 * and instance methods. For a complete detail of which methods are made available, check
 * {@link B}. Note that the `id` field is automatically added, and should not be described
 * using @field (or included in the base class at all for that matter).
 * 
 * @example
 * class User {
 *  @field
 *  name: string;
 * 
 *  @field
 *  age: number;
 * }
 * const UserModel = Based(User); // table name will be `user`.
 * 
 * // UserModel is of type B<User> and can now be used normally:
 * const instance = new UserModel();
 * await instance.save();
 * const firstUser = await UserModel.first();
 * await firstUser.destroy();
 */
export function Based<Template extends Basie>(Base: AbstractConstructor<Template>, tableName?: string): B<Template> {
    tableName = tableName || Base.name.toLowerCase();

    // Ensure that the base type has no custom constructor.
    if (Base.length !== 0) {
        throw new Error("Basie classes cannot have a custom constructor.");
    }

    const basieProto: BasiePrototype = Base.prototype;
    const declaredFields = basieProto.__basieFields || [];
    const childrenFields = basieProto.__basieChildFields || [];

    // Typescript does not recognize the constructor as valid, so we hack our way around it.
    const BaseAsValidConstructor: { new(...args: any[]): Basie } = <any>Base;
    class BasieClass extends BaseAsValidConstructor {
        __poisoned = false;

        constructor(public __props: KeyedAnyObject = {}) {
            super();
        }

        static createTable(): Promise<void> {
            if (declaredFields.some(x => !x.fieldType)) {
                throw new Error(`createTable() needs decorator metadata enabled to work. Add "emitDecoratorMetadata": true to your tsconfig.json compilerOptions`);
            }

            const syntax = fields((n, f) => {
                const type = (<{ [key: string]: string }>{ "String": "TEXT", "Number": "REAL", "Boolean": "INTEGER" })[f.fieldType!.name];
                return n + " " + type + " NOT NULL"; // all fields should be non-null.
            }, ", ");

            return Database.run(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, ${syntax})`);
        }

        static dropTable(): Promise<void> {
            return Database.run(`DROP TABLE IF EXISTS ${tableName}`);
        }

        static find(id: number): Promise<Template | undefined> {
            return Database.get<any>(`SELECT * FROM ${tableName} WHERE id = ?`, [id]).then(x => x && BasieClass.materialize(x));
        }

        static first(): Promise<Template | undefined> {
            return Database.get<any>(`SELECT * FROM ${tableName} LIMIT 1`).then(x => x && BasieClass.materialize(x));
        }

        static all(): Promise<Template[]> {
            return Database.all(`SELECT * FROM ${tableName}`).then(x => Promise.all(x.map(BasieClass.materialize)));
        }

        static findBy(params: Partial<Template>): Promise<Template | undefined> {
            const columns = toColumnNames(params);
            return Database.get(
                `SELECT * FROM ${tableName} WHERE ${columns.map(x => x[1] + " = ?").join(" AND ")} LIMIT 1`,
                columns.map(x => params[x[0]])
            ).then(x => x && BasieClass.materialize(x));
        }

        static where(params: Partial<Template> | string, ...args: any[]): Promise<Template[]> {
            // Simple where clause.
            if (typeof params === "string") {
                return Database.all(`SELECT * FROM ${tableName} WHERE ${params}`, args).then(x => Promise.all(x.map(BasieClass.materialize)));
            }

            // Partial
            const columns = toColumnNames(params);
            return Database.all(
                `SELECT * FROM ${tableName} WHERE ${columns.map(x => x[1] + " = ?").join(" AND ")}`,
                columns.map(x => params[x[0]])
            ).then(x => Promise.all(x.map(BasieClass.materialize)));
        }

        // Converts the raw sqlite response to the instance of the Template.
        static async materialize(object: KeyedAnyObject): Promise<Template> {
            const instance = <Template><any>new BasieClass(object);

            // Load children.
            for (const child of childrenFields) {
                const foreignKey = child.foreignKey || tableName + "_id";
                instance.__props[child.fieldName] = await child.foreignType(0).where(foreignKey + " = ?", object.id);

                // Freeze the children array. Changing it has no effect, and thus we prevent it to hopefully prevent misunderstandings.
                Object.freeze(instance.__props[child.fieldName]);
            }

            return instance;
        }

        get id() {
            if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");
            return this.__props.id;
        }

        // This is technically not needed, since the field is readonly, but we add it anyway.
        set id(val: number) {
            throw new Error("Cannot manually set the ID of " + tableName);
        }

        save(): Promise<void> {
            if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");

            const values = declaredFields.map(x => this.__props[x.columnName]);
            if (values.some(x => x == null)) throw new Error("Trying to save() a document with null or undefined members.");

            // If the id is undefined (or null), this is a newly created document.
            if (this.id == null) {
                // This has to run sequentially since we need the inserted id.
                return new Promise<void>(resolve => Database.runSequentially(() => {
                    Database.run(
                        `INSERT INTO ${tableName} (${fields(x => x)}) VALUES (${fields(x => "?")})`,
                        values
                    );

                    Database.get<{ id: number }>(
                        `SELECT last_insert_rowid() as id FROM ${tableName}`
                    ).then(res => {
                        this.__props.id = res!.id;
                        resolve();
                    });
                }));
            } else {
                return Database.run(
                    `UPDATE ${tableName} SET ${fields(x => x + " = ?")} WHERE id = ?`,
                    values.concat(this.id)
                );
            }
        }

        async destroy(): Promise<void> {
            if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");

            // Deleting a non-existent object is a no-op.
            if (this.id == null) return;

            await Database.run(`DELETE FROM ${tableName} WHERE id = ?`, [this.id]);
            delete this.__props.id; // stay consistent by having id being undefined if the document doesn't exist
            this.__poisoned = true;
        }

        // Override toJSON behavior to strip out __props and __poisoned and add id and actual props.
        toJSON(): object {
            const ret = Object.assign({}, this);
            delete ret.__poisoned;
            delete ret.__props;
            return Object.assign(ret, this.__props);
        }
    }

    // Utility function that generates a joined string of field names.
    function fields(fn: (name: string, r: FieldMetadata) => string, joiner: string = ","): string {
        return declaredFields.map(x => fn(x.columnName, x)).join(joiner);
    }

    // Utility method to convert all declaredFields to an array of [fieldName, columnName].
    function toColumnNames(obj: KeyedAnyObject): string[][] {
        return Object.keys(obj).map(k => [k, declaredFields.find(x => x.fieldName === k)!.columnName]);
    }

    return <B<Template>><any>BasieClass;
}