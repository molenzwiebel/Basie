import { DatabaseType, KeyedDatabaseResult } from "./base-model";
import SQLGrammarCompiler from "./query/compiler";

/**
 * Represents an engine for an SQL-based database.
 */
export interface DatabaseEngine {
    /**
     * Runs the specified query against the database and voids the results (if any).
     * @param {string} sql The SQL to execute. ? is used as placeholder for bound values.
     * @param {any[]} params The parameters, which should replace the '?' placeholders.
     * @returns {Promise<void>}
     */
    query(sql: string, params: DatabaseType[]): Promise<void>;

    /**
     * Runs the specified query against the database and returns the result as an array
     * of objects of format { columnName: value }.
     * @param {string} sql The SQL to execute. ? is used as placeholder for bound values.
     * @param {any[]} params The parameters, which should replace the '?' placeholders.
     * @returns {Promise<KeyedDatabaseResult>}
     */
    get(sql: string, params: DatabaseType[]): Promise<KeyedDatabaseResult[]>;

    /**
     * Runs the specified insert query and returns the ID of the inserted row.
     */
    insertAndGetId(table: string, sql: string, params: DatabaseType[]): Promise<number>;

    /**
     * Returns the SQLGrammarCompiler responsible for compiling QueryBuilders into actual
     * SQL queries. This may be a raw SQLGrammarCompiler or a subclass for database-specific
     * minor changes to the queries.
     */
    getGrammarCompiler(): SQLGrammarCompiler;
}