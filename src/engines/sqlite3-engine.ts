import { DatabaseEngine } from "../database-engine";
import { Database } from "sqlite3";
import { DatabaseType, KeyedDatabaseResult } from "../base-model";
import SQLGrammarCompiler from "../query/compiler";

export default class Sqlite3Engine implements DatabaseEngine {
    private connection: Database;

    constructor(connection: Database) {
        this.connection = connection;
    }

    query(sql: string, params: DatabaseType[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.connection.run(sql, params, err => {
                err ? reject(err) : resolve();
            });
        });
    }

    get(sql: string, params: DatabaseType[]): Promise<KeyedDatabaseResult[]> {
        return new Promise((resolve, reject) => {
            this.connection.all(sql, params, (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });
    }

    insertAndGetId(table: string, sql: string, params: DatabaseType[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.serialize(async () => {
                await this.query(sql, params);
                this.get("SELECT last_insert_rowid() AS id FROM " + table, []).then(x => <number>x[0]["id"]).then(resolve, reject);
            });
        });
    }

    getGrammarCompiler(): SQLGrammarCompiler {
        return new SQLGrammarCompiler();
    }
}