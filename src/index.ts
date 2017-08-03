import { Database as sqliteDatabase } from "sqlite3";
import { DatabaseEngine } from "./database-engine";
import * as pg from "pg";
import Sqlite3Engine from "./engines/sqlite3-engine";
import PostgresEngine from "./engines/postgres-engine";
import BaseModel, { DatabaseType, Wrapped } from "./base-model";
import { getTableName } from "./util";
import QueryBuilder from "./query/builder";

export class BasieStatic {
    private engine: DatabaseEngine | null = null;

    /**
     * Returns the engine currently in use, or throws if there is no engine configured.
     */
    public getEngine(): DatabaseEngine {
        if (!this.engine) throw new Error("No database engine has been configured. Ensure that you use Basie.use(engine) before attempting any queries.");
        return this.engine;
    }

    /**
     * Changes the current database engine to the specified engine.
     */
    public use(engine: DatabaseEngine) {
        this.engine = engine;
    }

    /**
     * Configures basie to be used with the specified sqlite database.
     */
    public sqlite(db: sqliteDatabase) {
        this.use(new Sqlite3Engine(db));
    }

    /**
     * Configures basie to be used with the specified postgres connection pool.
     */
    public postgres(db: pg.Pool) {
        this.use(new PostgresEngine(db));
    }

    /**
     * Wraps the specified model with basie-specific methods that give it static
     * querying methods. This does not create a table within the database, and
     * instead expects the table to already be present. This function is called
     * a bit weirdly (`Basie.wrap<_Model>()(_Model)`) to overcome some typescript
     * type system limits and statically typecheck that you're only using valid
     * members.
     */
    public wrap<InstanceType extends BaseModel, Fields extends string = keyof InstanceType>() {
        return <ConstructorFN extends { new(...args: any[]): InstanceType2 }, InstanceType2 extends Record<Fields, DatabaseType | Function>>(arg: ConstructorFN, tableName?: string) => {
            if (!tableName) tableName = getTableName(arg.name);

            const local = <Wrapped<ConstructorFN, InstanceType2>>arg;
            (<any>local).tableName = tableName;

            return <Wrapped<ConstructorFN, InstanceType>>new Proxy(local, {
                get(target: any, name) {
                    // If the property exists on the object itself (static method), return that.
                    if (typeof target[name] !== "undefined") return target[name];

                    const builder = <any>QueryBuilder.model(local);
                    // If it is not a function, act like it doesn't exist (which is probably the thruth).
                    if (typeof builder[name] !== "function") return undefined;

                    // Return that method of the QueryBuilder and bind it to the builder.
                    return builder[name].bind(builder);
                }
            });
        };
    }
}
export default new BasieStatic();