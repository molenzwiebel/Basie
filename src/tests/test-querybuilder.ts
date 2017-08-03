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
}