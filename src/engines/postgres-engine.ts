import { DatabaseEngine } from "../database-engine";
import * as pg from "pg";
import { DatabaseType, KeyedDatabaseResult } from "../base-model";
import SQLGrammarCompiler from "../query/compiler";

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

    insertAndGetId(table: string, sql: string, params: DatabaseType[]): Promise<number> {
        return this.get(sql + " RETURNING id", params).then(x => <number>x[0]["id"]);
    }

    getGrammarCompiler(): SQLGrammarCompiler {
        return new class extends SQLGrammarCompiler {
            protected escapeColumn(column: string): string {
                if (column === "*") return column;

                // We need to escape both parts of the as independently.
                if (column.toLowerCase().indexOf(" as ") !== -1) {
                    const [original, , alias] = column.split(" ");
                    return this.escapeColumn(original) + " AS " + this.escapeColumn(alias);
                }

                return column.split(".").map(x => '"' + x + '"').join(".");
            }

            protected escapeTable(table: string): string {
                return table.split(".").map(x => '"' + x + '"').join(".");
            }
        };
    }

    /**
     * Converts ? placeholders into numbered $# placeholders that postgres understands.
     */
    private transformQuery(sql: string, params: DatabaseType[]): { text: string, values: any[] } {
        let i = 1;

        return {
            text: sql.replace(/\?/g, () => "$" + (i++)),
            values: params
        };
    }
}