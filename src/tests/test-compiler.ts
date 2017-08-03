import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import QueryBuilder from "../query/builder";
import SQLGrammarCompiler from "../query/compiler";

function compileSelect<T>(fn: (builder: QueryBuilder<T>) => any, toEq: string, args?: any[]) {
    const builder = new QueryBuilder<T>();
    builder.from<T>("test");
    fn(builder);

    const built = new SQLGrammarCompiler().compileSelect(builder);
    expect(built.sql).to.equal(toEq);
    if (args) expect(built.args).to.deep.equal(args);
}

@suite
class SQLGrammarCompilerTests {
    @test
    compilesAggregateFunctions() {
        compileSelect(x => x.aggregateFunction = "SUM", "SELECT SUM(*) AS aggregate FROM test");
        compileSelect(x => x.aggregateFunction = "AVG", "SELECT AVG(*) AS aggregate FROM test");
        compileSelect(x => x.aggregateFunction = "MIN", "SELECT MIN(*) AS aggregate FROM test");
        compileSelect(x => x.aggregateFunction = "MAX", "SELECT MAX(*) AS aggregate FROM test");

        compileSelect(x => {
            x.aggregateFunction = "MAX";
            x.select("bar");
            x.distinct()
        }, "SELECT MAX(DISTINCT bar) AS aggregate FROM test");

        compileSelect(x => {
            x.aggregateFunction = "MAX";
            x.distinct()
        }, "SELECT MAX(*) AS aggregate FROM test");
    }

    @test
    compilesArbitraryColumns() {
        compileSelect(x => x.select("foo", "bar AS baz"), "SELECT foo, bar AS baz FROM test")
    }

    @test
    compilesDistinctColumns() {
        compileSelect(x => x.distinct(), "SELECT DISTINCT * FROM test");
    }

    @test
    compilesJoins() {
        compileSelect(x =>
            x.join("foo", "test.foo", "=", "foo.bar")
        , "SELECT * FROM test INNER JOIN foo ON test.foo = foo.bar");

        compileSelect(x =>
            x.leftJoin("foo", "test.foo", "=", "foo.bar")
        , "SELECT * FROM test LEFT JOIN foo ON test.foo = foo.bar");

        compileSelect(x =>
            x.rightJoin("foo", "test.foo", "=", "foo.bar")
        , "SELECT * FROM test RIGHT JOIN foo ON test.foo = foo.bar");

        compileSelect(x =>
            x.join("foo", nested => {
                nested.on("test.a", "=", "foo.b");
                nested.orOn("test.b", "=", "foo.c");
            })
        , "SELECT * FROM test INNER JOIN foo ON test.a = foo.b OR test.b = foo.c");

        compileSelect(x =>
            x.join("foo", nested => {
                nested.on(evenMoreNested => evenMoreNested.on("a", "=", "b").orOn("b", "=", "c"));
                nested.orOn("test.b", "=", "foo.c");
            })
        , "SELECT * FROM test INNER JOIN foo ON (a = b OR b = c) OR test.b = foo.c");
    }

    @test
    compilesBasicWheres() {
        compileSelect<{ foo: string }>(x => x.where("foo", "10"), "SELECT * FROM test WHERE foo = ?", ["10"]);
        compileSelect<{ foo: string, bar: number }>(x =>
            x.where("foo", "10").orWhere("bar", 200)
        , "SELECT * FROM test WHERE foo = ? OR bar = ?", ["10", 200]);
    }

    @test
    compilesColumnWheres() {
        compileSelect<{ foo: string, bar: string }>(x =>
            x.whereColumn("foo", "=", "bar")
        , "SELECT * FROM test WHERE foo = bar");

        compileSelect<{ foo: string, bar: string }>(x =>
            x.whereColumn("foo", "=", "bar").orWhereColumn("foo", "<", "bar")
        , "SELECT * FROM test WHERE foo = bar OR foo < bar");
    }

    @test
    compilesRawWheres() {
        compileSelect<{ a: string }>(x => x.whereRaw("a LIKE ?", ["Foo"]), "SELECT * FROM test WHERE a LIKE ?", ["Foo"]);
        compileSelect<{ a: string }>(x =>
            x.whereRaw("a LIKE ?", ["Foo"]).orWhereRaw("b LIKE ?", [10])
        , "SELECT * FROM test WHERE a LIKE ? OR b LIKE ?", ["Foo", 10]);
    }

    @test
    compilesNullWheres() {
        compileSelect<{ a: string }>(x => x.whereNull("a"), "SELECT * FROM test WHERE a IS NULL");
        compileSelect<{ a: string }>(x => x.whereNotNull("a"), "SELECT * FROM test WHERE a IS NOT NULL")

        compileSelect<{ a: string, b: string }>(x =>
            x.whereNull("a").orWhereNull("b")
        , "SELECT * FROM test WHERE a IS NULL OR b IS NULL");

        compileSelect<{ a: string, b: string }>(x =>
            x.whereNull("a").orWhereNotNull("b")
        , "SELECT * FROM test WHERE a IS NULL OR b IS NOT NULL");
    }

    @test
    compilesNestedWheres() {
        compileSelect<{ a: string, b: number }>(x =>
            x.where("a", "A").orWhere(nested => {
                nested.where("a", "B");
                nested.where("b", 10);
            })
        , "SELECT * FROM test WHERE a = ? OR (a = ? AND b = ?)", ["A", "B", 10]);

        compileSelect<{ a: string, b: number }>(x =>
            x.where("a", "A").orWhere(nested => {
                nested.where("a", "B");
                nested.orWhereNested(n => n.where("b", 10));
            })
        , "SELECT * FROM test WHERE a = ? OR (a = ? OR (b = ?))", ["A", "B", 10]);
    }

    @test
    compilesGroups() {
        compileSelect<{ a: string, b: number }>(x => x.groupBy("a"), "SELECT * FROM test GROUP BY a");
        compileSelect<{ a: string, b: number }>(x => x.groupBy("a", "b"), "SELECT * FROM test GROUP BY a, b");
    }

    @test
    compilesOrders() {
        compileSelect<{ a: string, b: number }>(x => x.orderBy("a"), "SELECT * FROM test ORDER BY a ASC");
        compileSelect<{ a: string, b: number }>(x => x.orderByAsc("a"), "SELECT * FROM test ORDER BY a ASC");
        compileSelect<{ a: string, b: number }>(x => x.orderByDesc("a"), "SELECT * FROM test ORDER BY a DESC");
        compileSelect<{ a: string, b: number }>(x => x.orderBy("a").orderByDesc("b"), "SELECT * FROM test ORDER BY a ASC, b DESC");
    }

    @test
    compilesLimits() {
        compileSelect(x => x.limit(10), "SELECT * FROM test LIMIT ?", [10]);
    }

    @test
    compilesInserts() {
        const builder = new QueryBuilder();
        builder.from<{ a: string, b: number }>("test");

        let result = new SQLGrammarCompiler().compileInsert(builder, [{ a: "Foo", b: 10 }]);
        expect(result.sql).to.equal("INSERT INTO test (a,b) VALUES (?,?)");
        expect(result.args).to.deep.equal(["Foo", 10]);

        result = new SQLGrammarCompiler().compileInsert(builder, [{ a: "Foo", b: 10 }, { a: "Bar", b: 12 }]);
        expect(result.sql).to.equal("INSERT INTO test (a,b) VALUES (?,?), (?,?)");
        expect(result.args).to.deep.equal(["Foo", 10, "Bar", 12]);
    }

    @test
    compilesUpdates() {
        const builder = new QueryBuilder();
        builder.from<{ a: string, b: number }>("test").where("b", 10);

        let result = new SQLGrammarCompiler().compileUpdate(builder, { a: "Foo" });
        expect(result.sql).to.equal("UPDATE test SET a = ? WHERE b = ?");
        expect(result.args).to.deep.equal(["Foo", 10]);

        result = new SQLGrammarCompiler().compileUpdate(builder, { a: "Foo", b: 12 });
        expect(result.sql).to.equal("UPDATE test SET a = ?, b = ? WHERE b = ?");
        expect(result.args).to.deep.equal(["Foo", 12, 10]);

        builder.join("foo", "foo.a", "=", "test.b");
        result = new SQLGrammarCompiler().compileUpdate(builder, { a: "Foo", b: 12 });
        expect(result.sql).to.equal("UPDATE test INNER JOIN foo ON foo.a = test.b SET a = ?, b = ? WHERE b = ?");
        expect(result.args).to.deep.equal(["Foo", 12, 10]);
    }

    @test
    compilesDeletes() {
        const builder = new QueryBuilder().from<{ a: string, b: number }>("test");

        let result = new SQLGrammarCompiler().compileDelete(builder);
        expect(result.sql).to.equal("DELETE FROM test");

        result = new SQLGrammarCompiler().compileDelete(builder.where("b", 10));
        expect(result.sql).to.equal("DELETE FROM test WHERE b = ?");
        expect(result.args).to.deep.equal([10]);
    }
}