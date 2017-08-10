import QueryBuilder from "./builder";
import { JoinType, Operator, QueryBoolean } from "./types";

/**
 * Represents a QueryBuilder for a nested join clause.
 * We essentially abuse QueryBuilder's WHERE building since it works
 * exactly the same as the ON clause of a join.
 */
export default class JoinClause extends QueryBuilder<any> {
    public type: JoinType;
    public joiningOn: string;

    constructor(type: JoinType, joiningOn: string) {
        super();

        this.table = joiningOn;
        this.type = type;
        this.joiningOn = joiningOn;
    }

    /**
     * Creates a new nested ON clause. The specified callback receives a nested
     * query builder that can be used to build the nested queries.
     */
    public on(method: (builder: this) => any): this;

    /**
     * Adds a new ON clause for the specified column, operator and value. Optionally
     * you can provide a QueryBoolean of "OR" instead of "AND", but it is recommended that
     * you use `orOn` instead.
     */
    public on(first: string, operator: Operator, second: string, boolean?: QueryBoolean): this;

    public on(firstOrMethod: string | ((builder: this) => any), operator?: Operator, second?: string, boolean: QueryBoolean = "AND") {
        if (typeof firstOrMethod === "function") {
            return this.whereNested(firstOrMethod, boolean);
        }

        return this.whereColumn(firstOrMethod, operator!, second!, boolean);
    }

    /**
     * Creates a new nested OR ON clause. The specified callback receives a nested
     * query builder that can be used to build the nested queries.
     */
    public orOn(method: () => any): this;

    /**
     * Adds a new OR ON clause for the specified column, operator and value.
     */
    public orOn(first: string, operator: Operator, second: string): this;

    public orOn(firstOrMethod: string | (() => any), operator?: Operator, second?: string) {
        return (<any>this.on)(firstOrMethod, operator, second, "OR");
    }

    protected createNew(): this {
        return <this>new JoinClause(this.type, this.joiningOn);
    }
}