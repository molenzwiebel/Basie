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

        await QueryBuilder.table<User>("users").insert({ name: "Thijs", age: 17 });

        const first = await User.find(1);
        expect(first).to.not.equal(undefined);
        expect(first!.name).to.equal("Thijs");

        const second = await User.where("age", 17).first();
        expect(second).to.not.equal(undefined);
        expect(second!.age).to.equal(17);
    }

    @test
    async "inserts, updates and deletes"() {
        class _User extends BaseModel {
            public name: string;
            public age: number;
        }
        const User = Basie.wrap<_User>()(_User);
        type User = _User;

        const user = new User();
        user.name = "Thijs";
        user.age = 17;
        expect(user.id).to.equal(undefined);
        await user.save();

        expect(user.id).to.equal(1);

        user.age = 18;
        await user.save();

        expect(user.id).to.equal(1);
        expect(await User.where("age", 18).count()).to.equal(1);

        await user.delete();
        expect(user.id).to.equal(undefined);

        expect(() => {
            user.delete();
        }).to.throw("Cannot delete object if it is not in the database.");
    }
}