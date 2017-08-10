import { suite, test as mochaTest } from "mocha-typescript";
import { expect } from "chai";

import * as mysql from "mysql2/promise";
import Basie from "../";

import QueryBuilder from "../query/builder";

function builder() {
    return QueryBuilder.table<{ id: number, name: string, age: number }>("users");
}

// Skip tests if no postgres connection is defined.
const test = process.env.MYSQL_HOST ? mochaTest : mochaTest.skip;

@suite
class MySQLTests {
    async before() {
        if (!process.env.MYSQL_HOST) return;

        const connection = await mysql.createConnection(<any>{
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            host: process.env.MYSQL_HOST,
            port: +process.env.MYSQL_PORT!,
            decimalNumbers: true
        });

        await connection.query("DROP TABLE IF EXISTS users");
        await connection.query("CREATE TABLE users (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, name TEXT, age INTEGER)");

        Basie.mysql(connection);
    }

    async after() {
        // Ensure that database is clean unset after our tests.
        Basie.use(<any>null);
    }

    @test
    async inserts() {
        await builder().insert({ name: "Thijs", age: 17 });
        expect(await builder().exists()).to.equal(true);
        expect(await builder().all()).to.have.length(1);
    }

    @test
    async updates() {
        await builder().insert({ name: "Thijs", age: 17 });
        await builder().where("id", 1).update({ age: 18 });
        expect(await builder().where("id", 1).value("age")).to.equal(18);
    }

    @test
    async deletes() {
        await builder().insert({ name: "Thijs", age: 17 });
        await builder().where("name", "Thijs").delete();
        expect(await builder().count()).to.equal(0);
    }

    @test
    async aggregates() {
        await builder().insert({ name: "Thijs", age: 17 }, { name: "Silke", age: 15 }, { name: "Marcel", age: 52 }, { name: "Christien", age: 50 });
        expect(await builder().count()).to.equal(4);
        expect(await builder().min("age")).to.equal(15);
        expect(await builder().max("age")).to.equal(52);
        expect(await builder().avg("age")).to.equal(33.5);
        expect(await builder().sum("age")).to.equal(134);
    }

    @test
    async fetching() {
        await builder().insert({ name: "Thijs", age: 17 }, { name: "Silke", age: 15 }, { name: "Marcel", age: 52 }, { name: "Christien", age: 50 });

        expect(await builder().pluck("name")).to.deep.equal(["Thijs", "Silke", "Marcel", "Christien"]);
        expect(await builder().first()).property("name").to.equal("Thijs");
        expect(await builder().where("name", "LIKE", "%i%").count()).to.equal(3);
    }

    @test
    async escapesAsProperly() {
        await builder().insert({ name: "Thijs", age: 17 });
        expect(await builder().select("age AS myAge").value("myAge")).to.equal(17);
    }

    @test
    async insertingWithId() {
        expect(await Basie.getEngine().insertAndGetId("users", "INSERT INTO users (name, age) VALUES (?, ?)", ["Thijs", 17])).to.equal(1);
        expect(await Basie.getEngine().insertAndGetId("users", "INSERT INTO users (name, age) VALUES (?, ?)", ["Silke", 15])).to.equal(2);
    }
}