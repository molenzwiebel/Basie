import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import Based, { Basie, field, Database } from "../";

/**
 * This only tests behaviors specific to _no metadata_. For all other tests,
 * check test-metadata.ts.
 */
@suite("Basie without metadata")
class NoMetadata {
    oldFn: any;

    // Setup database.
    static async before() {
        await Database.connect(":memory:");
    }

    static async after() {
        await Database.close();
    }

    before() {
        // Ensure that we have no metadata.
        if (Reflect && (<any>Reflect).metadata) {
            this.oldFn = (<any>Reflect).metadata;
            delete (<any>Reflect).metadata;
        }
    }

    after() {
        // Restore metadata.
        if (Reflect && this.oldFn) {
            (<any>Reflect).metadata = this.oldFn;
        }
    }

    @test
    "throws on createTable"() {
        abstract class UserTemplate extends Basie {
            @field
            name: string;
        }

        return expect(() => {
            Based(UserTemplate).createTable();
        }).to.throw("createTable() needs decorator metadata enabled to work.");
    }
}