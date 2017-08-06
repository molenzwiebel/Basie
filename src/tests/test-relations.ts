import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import { Database } from "sqlite3";
import Basie from "../";
import BaseModel, { A, R } from "../base-model";

class _User extends BaseModel {
    public name: string;
    public age: number;
    public phone_id: number;

    public readonly phone: R<Phone> = this.hasOne(Phone);
    public readonly phones: A<Phone> = this.hasMany(Phone);
}
const User = Basie.wrap<_User>()(_User);
type User = _User;

class _Phone extends BaseModel {
    public number: string;
    public user_id: number;

    public readonly hasUser: R<User> = this.hasOne(User);
    public readonly user: R<User> = this.belongsTo(User);
}
const Phone = Basie.wrap<_Phone>()(_Phone);
type Phone = _Phone;

@suite
class RelationTests {
    async before() {
        let db: Database;

        await new Promise(resolve => db = new Database(":memory:", () => resolve()));
        await new Promise(resolve => db.exec("CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, name TEXT, age INTEGER, phone_id INTEGER)", () => resolve()));
        await new Promise(resolve => db.exec("CREATE TABLE phones (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, number TEXT, user_id INTEGER)", () => resolve()));

        Basie.sqlite(db!);
    }

    async after() {
        // Ensure that database is clean unset after our tests.
        Basie.use(<any>null);
    }

    @test
    async hasOne() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });

        const user = (await User.first())!;

        const phone = await user.phone();
        expect(phone.number).to.equal("123");

        const back = await phone.hasUser();
        expect(back.name).to.equal("Thijs");

        const phone2 = await user.phone();
        expect(phone).to.equal(phone2); // lazy loading
    }

    @test
    async belongsTo() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });

        const user = (await User.first())!;
        const back = await user.phone().then(x => x.user());
        expect(user.name).to.equal(back.name);
        expect(user.id).to.equal(back.id);
    }

    @test
    async hasMany() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });
        await Phone.insert({ number: "456", user_id: 1 });

        const user = (await User.first())!;
        const phones = await user.phones();
        expect(phones).to.have.length(2);
        expect(phones.map(x => x.number)).to.eql(["123", "456"]);
    }

    @test
    async actsAsQueryBuilder() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });
        await Phone.insert({ number: "456", user_id: 1 });

        const user = (await User.first())!;
        const allWith3 = await user.phones.where("number", "LIKE", "%3%").get();
        expect(allWith3).to.have.length(1);
        expect(allWith3[0].number).to.equal("123");

        expect(await user.phone.count()).to.equal(2);
        expect(await allWith3[0].user.pluck("name")).to.deep.equal(["Thijs"]);

        expect(() => {
            (<any>user.phones).foo;
        }).to.throw("Invalid QueryBuilder member");

        expect(() => {
            (<any>user.phone).foo;
        }).to.throw("Invalid QueryBuilder member");

        expect(() => {
            (<any>allWith3[0].user).foo;
        }).to.throw("Invalid QueryBuilder member");
    }

    @test
    async isLazy() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });
        await Phone.insert({ number: "456", user_id: 1 });

        const user = (await User.first())!;

        expect(await user.phone()).to.equal(await user.phone());
        expect(await user.phones()).to.equal(await user.phones());

        const phone = (await Phone.first())!;
        expect(await phone.user()).to.equal(await phone.user());
        expect(await phone.hasUser()).to.equal(await phone.hasUser());
    }

    @test
    async isImmutable() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });

        const phone2 = new Phone();
        const phones = await (await User.first())!.phones();

        expect(() => {
            phones.push(phone2);
        }).to.throw("object is not extensible");
    }
}