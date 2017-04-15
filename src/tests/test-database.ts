import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import { Database } from "../";

function expectRejection(promise: Promise<any>) {
    return promise.then(x => { throw x; }, x => x);
}

@suite("Basie Database")
class DatabaseTests {
    async after() {
        if (Database.isConnected) {
            return Database.close();
        }
    }

    @test
    async "connects"() {
        return Database.connect(":memory:");
    }

    @test
    async "promises reject on invalid operations"() {
        await Database.connect(":memory:");

        await expectRejection(Database.run("SELECT"));
        await expectRejection(Database.get("SELECT"));
        await expectRejection(Database.all("SELECT"));
    }

    @test
    async "keeps track of connection state"() {
        expect(Database.isConnected).to.equal(false);
        await Database.connect(":memory:");
        expect(Database.isConnected).to.equal(true);

        expect(() => {
            Database.connect(":memory:");
        }).to.throw("Already connected");

        await Database.close();
        expect(Database.isConnected).to.equal(false);

        expect(() => {
            Database.close();
        }).to.throw("Not connected");

        expect(() => {
            Database.run("SELECT * FROM user");
        }).to.throw("Not connected");

        expect(() => {
            Database.get("SELECT * FROM user");
        }).to.throw("Not connected");

        expect(() => {
            Database.all("SELECT * FROM user");
        }).to.throw("Not connected");

        expect(() => {
            Database.runSequentially(() => {});
        }).to.throw("Not connected");
    }
}