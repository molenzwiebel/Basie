import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import { Database } from "sqlite3";
import Basie from "../";

import QueryBuilder from "../query/builder";

function builder() {
    return QueryBuilder.table<{ id: number, name: string, age: number }>("users");
}

@suite
class QueryTests {
    async before() {
        let db: Database;

        await new Promise(resolve => db = new Database(":memory:", () => resolve()));
        await new Promise(resolve => db.exec("CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, name TEXT, age INTEGER)", () => resolve()));

        Basie.sqlite(db!);
    }

    @test
    async inserts() {
        await builder().insert({ id: 0, name: "Thijs", age: 17 });
        expect(await builder().exists()).to.equal(true);
    }

    @test
    async updates() {
        await builder().insert({ id: 0, name: "Thijs", age: 17 });
        await builder().where("id", 0).update({ age: 18 });
        expect(await builder().where("id", 0).value("age")).to.equal(18);
    }

    @test
    async deletes() {
        await builder().insert({ id: 0, name: "Thijs", age: 17 });
        await builder().where("id", 0).delete();
        expect(await builder().count()).to.equal(0);
    }

    @test
    async aggregates() {
        await builder().insert({ id: 0, name: "Thijs", age: 17 }, { id: 1, name: "Silke", age: 15 }, { id: 2, name: "Marcel", age: 52 }, { id: 3, name: "Christien", age: 50 });
        expect(await builder().count()).to.equal(4);
        expect(await builder().min("age")).to.equal(15);
        expect(await builder().max("age")).to.equal(52);
        expect(await builder().avg("age")).to.equal(33.5);
        expect(await builder().sum("age")).to.equal(17 + 15 + 52 + 50);
    }

    @test
    async fetching() {
        await builder().insert({ id: 0, name: "Thijs", age: 17 }, { id: 1, name: "Silke", age: 15 }, { id: 2, name: "Marcel", age: 52 }, { id: 3, name: "Christien", age: 50 });

        expect(await builder().pluck("name")).to.deep.equal(["Thijs", "Silke", "Marcel", "Christien"]);
        expect(await builder().first()).property("name").to.equal("Thijs");
        expect(await builder().where("name", "LIKE", "%i%").count()).to.equal(3);
    }
}