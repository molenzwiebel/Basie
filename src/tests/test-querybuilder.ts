import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import QueryBuilder from "../query/builder";

@suite
class QueryBuilderTests {
    @test
    throwsOnInvalidLimit() {
        expect(() => {
            new QueryBuilder().limit(-1);
        }).to.throw("limit() expects a positive integer");

        expect(() => {
            new QueryBuilder().limit(0);
        }).to.throw("limit() expects a positive integer");
    }
}