import { suite, test } from "mocha-typescript";
import { expect } from "chai";

@suite
class Tests {
    @test
    works() {
        expect(1).to.eq(1);
        expect(1).to.not.eq(2);
    }
}