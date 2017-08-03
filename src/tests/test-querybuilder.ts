import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import QueryBuilder from "../query/builder";

@suite
class QueryBuilderTests {
    @test
    throwsOnInvalidLimit() {
        expect(() => {
            QueryBuilder.table("test").limit(-1);
        }).to.throw("limit() expects a positive integer");

        expect(() => {
            QueryBuilder.table("test").limit(0);
        }).to.throw("limit() expects a positive integer");
    }

    @test
    throwsOnUnsetEngine() {
        expect(() => {
            QueryBuilder.table("test").get();
        }).to.throw("No database engine has been configured. Ensure that you use Basie.use(engine) before attempting any queries.");
    }
}