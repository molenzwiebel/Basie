import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import { Database } from "sqlite3";
import Basie from "../";
import BaseModel, { A, R } from "../base-model";
import QueryBuilder from "../query/builder";

class _User extends BaseModel {
    public name: string;
    public age: number;
    public phone_id: number;

    public readonly phone: R<Phone> = this.hasOne(Phone);
    public readonly phones: A<Phone> = this.hasMany(Phone);

    public readonly allPhones: A<Phone> = this.hasAndBelongsToMany(Phone);
}
const User = Basie.wrap<_User>()(_User);
type User = _User;

class _Phone extends BaseModel {
    public number: string;
    public user_id: number;

    public readonly hasUser: R<User> = this.hasOne(User);
    public readonly user: R<User> = this.belongsTo(User);

    public readonly allUsers: A<User> = this.hasAndBelongsToMany(User);
}
const Phone = Basie.wrap<_Phone>()(_Phone);
type Phone = _Phone;

@suite
class RelationTests {
    async before() {
        let db: Database;

        await new Promise(resolve => db = new Database(":memory:", () => resolve()));
        Basie.sqlite(db!);

        await QueryBuilder.execute("CREATE TABLE users (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, name TEXT, age INTEGER, phone_id INTEGER)");
        await QueryBuilder.execute("CREATE TABLE phones (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE, number TEXT, user_id INTEGER)");
        await QueryBuilder.execute("CREATE TABLE phones_users (user_id INTEGER, phone_id INTEGER)");
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
    async hasAndBelongsToMany() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await User.insert({ name: "Silke", age: 16, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 2 });
        await Phone.insert({ number: "456", user_id: 2 });

        await QueryBuilder.table<{ phone_id: number, user_id: number }>("phones_users").insert({ phone_id: 1, user_id: 1 }, { phone_id: 2, user_id: 1 });

        const user = (await User.first())!;
        const phones = await user.allPhones();
        expect(phones.length).to.equal(2);
        const users = await phones[0].allUsers();
        expect(users.length).to.equal(1);

        const usersAbove20 = await phones[0].allUsers.where("age", ">=", 20).get();
        expect(usersAbove20.length).to.equal(0);
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

        expect((<any>user.phone).foo).to.equal(undefined);
        expect((<any>user.phones).foo).to.equal(undefined);
        expect((<any>user.allPhones).foo).to.equal(undefined);
        expect((<any>allWith3[0].user).foo).to.equal(undefined);
    }

    @test
    async isLazy() {
        await User.insert({ name: "Thijs", age: 17, phone_id: 1 });
        await Phone.insert({ number: "123", user_id: 1 });
        await Phone.insert({ number: "456", user_id: 1 });

        const user = (await User.first())!;

        expect(await user.phone()).to.equal(await user.phone());
        expect(await user.phones()).to.equal(await user.phones());
        expect(await user.allPhones()).to.equal(await user.allPhones());

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