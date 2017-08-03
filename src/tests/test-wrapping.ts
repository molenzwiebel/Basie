import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import { Database } from "sqlite3";
import Basie from "../";
import BaseModel from "../base-model";
import QueryBuilder from "../query/builder";

@suite
class WrappingTests {
    async before() {
        let db: Database;

        await new Promise(resolve => db = new Database(":memory:", () => resolve()));
        await new Promise(resolve => db.exec("CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, name TEXT, age INTEGER)", () => resolve()));

        Basie.sqlite(db!);
    }

    async after() {
        // Ensure that database is clean unset after our tests.
        Basie.use(<any>null);
    }

    @test
    async allowsCustomName() {
        class _User extends BaseModel {
            public name: string;
            public age: number;
        }
        const User = Basie.wrap<_User>()(_User, "user");
        type User = _User;

        expect(User.where(x => {}).table).to.equal("user");
    }

    @test
    async proxiesToQueryBuilder() {
        class _User extends BaseModel {
            public name: string;
            public age: number;
        }
        const User = Basie.wrap<_User>()(_User);
        type User = _User;

        await QueryBuilder.table<User>("users").insert({ id: 0, name: "Thijs", age: 17 });

        const first = await User.find(0);
        expect(first).to.not.equal(undefined);
        expect(first!.name).to.equal("Thijs");

        const second = await User.where("age", 17).first();
        expect(second).to.not.equal(undefined);
        expect(second!.age).to.equal(17);
    }
}