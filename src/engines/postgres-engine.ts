import { DatabaseEngine } from "../database-engine";
import * as pg from "pg";
import { DatabaseType, KeyedDatabaseResult } from "../base-model";

export default class PostgresEngine implements DatabaseEngine {
    private pool: pg.Pool;

    constructor(pool: pg.Pool) {
        this.pool = pool;
    }

    query(sql: string, params: DatabaseType[]): Promise<void> {
        return this.pool.query(this.transformQuery(sql, params)).then(() => {});
    }

    get(sql: string, params: DatabaseType[]): Promise<KeyedDatabaseResult[]> {
        return this.pool.query(this.transformQuery(sql, params)).then(x => x.rows);
    }

    /**
     * Converts ? placeholders into numbered $# placeholders that postgres understands.
     */
    private transformQuery(sql: string, params: DatabaseType[]): { text: string, values: any[] } {
        let i = 0;

        return {
            text: sql.replace("?", () => "$" + (i++)),
            values: params
        };
    }
}