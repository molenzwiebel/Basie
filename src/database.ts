import { Database, verbose } from "sqlite3";
verbose();

export class DatabaseConnection {
    private isConnected = false;
    private connection: Database | null = null;

    /**
     * Connects to the specified database path. This file is created
     * if it does not yet exist. `:memory:` can be used to create a
     * database instance completely in memory.
     */
    connect(path: string): Promise<void> {
        if (this.isConnected) throw new Error("Already connected.");

        return new Promise<void>((resolve, reject) => {
            this.connection = new Database(path, (err) => {
                if (err) return reject(err);

                this.isConnected = true;
                resolve();
            });
        });
    }

    /**
     * Closes the database. Throws if it was not open.
     */
    close(): Promise<void> {
        if (!this.isConnected) throw new Error("Not connected.");

        return new Promise<void>(resolve => {
            this.connection!.close(() => {
                this.connection = null;
                this.isConnected = false;
                resolve();
            });
        });
    }

    /**
     * Runs the specified query, throwing away any results. The
     * params array can be used to safely escape arguments.
     * 
     * @example
     * Database.run(`SELECT * FROM foo WHERE id = ?`, [id]);
     */
    run(query: string, params: any[] = []): Promise<void> {
        if (!this.isConnected) throw new Error("Not connected.");

        return new Promise<void>((resolve, reject) => {
            this.connection!.run(query, params || [], err => {
                err ? reject(err) : resolve();
            });
        });
    }

    /**
     * Runs the specified query, returning the first row of results, or
     * undefined if there were no results. The params array can be used to
     * safely escape arguments (see {@link run} for example usage).
     */
    get<T>(query: string, params: any[] = []): Promise<T | undefined> {
        if (!this.isConnected) throw new Error("Not connected.");

        return new Promise<T | undefined>((resolve, reject) => {
            this.connection!.get(query, params || [], (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });
    }

    /**
     * Runs the specified query, returning all rows as an array, or an empty
     * array if there were no results. The params array can be used to
     * safely escape arguments (see {@link run} for example usage).
     */
    all<T>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.isConnected) throw new Error("Not connected.");

        return new Promise<T[] | undefined>((resolve, reject) => {
            this.connection!.all(query, params || [], (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });
    }

    /**
     * Ensures that all database statements ran within the specified
     * callback run sequentially. Queries are still ran asynchronously,
     * but within the closure the order is deterministic.
     */
    runSequentially(fn: () => void) {
        if (!this.isConnected) throw new Error("Not connected.");
        return this.connection!.serialize(fn);
    }
}

export default new DatabaseConnection();