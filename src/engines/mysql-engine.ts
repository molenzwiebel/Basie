import { DatabaseEngine } from "../database-engine";
import * as mysql from "mysql2/promise";
import { DatabaseType, KeyedDatabaseResult } from "../base-model";
import SQLGrammarCompiler from "../query/compiler";

export default class MySQLEngine implements DatabaseEngine {
    private connection: mysql.Connection;

    constructor(connection: mysql.Connection) {
        this.connection = connection;
    }

    query(sql: string, params: DatabaseType[]): Promise<void> {
        return this.connection.execute(sql, params).then(x => {});
    }

    get(sql: string, params: DatabaseType[]): Promise<KeyedDatabaseResult[]> {
        return this.connection.execute<mysql.RowDataPacket[]>(sql, params).then(x => x[0]);
    }

    insertAndGetId(table: string, sql: string, params: DatabaseType[]): Promise<number> {
        return this.connection.query<mysql.OkPacket>(sql, params).then(results => {
            return results[0].insertId;
        });
    }

    getGrammarCompiler(): SQLGrammarCompiler {
        return new SQLGrammarCompiler();
    }
}