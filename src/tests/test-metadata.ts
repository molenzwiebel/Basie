import { suite, test } from "mocha-typescript";
import { expect } from "chai";

import Based, { Basie, field, children, Database, B } from "../";

abstract class User extends Basie {
    @field
    name: string;

    @field
    age: number;

    @children(type => RoleModel)
    roles: Role[];

    static async setup() {
        await UserModel.createTable();
        await RoleModel.createTable();

        let u = new UserModel();
        u.name = "Thijs";
        u.age = 17;
        await u.save();

        u = new UserModel();
        u.name = "Willem";
        u.age = 17;
        await u.save();
    }
}
const UserModel = Based(User);

abstract class Role extends Basie {
    @field
    name: string;

    @field("user_id")
    owner: number;

    static async addRole(owner: User, name: string) {
        const r = new RoleModel();
        r.name = name;
        r.owner = owner.id;
        await r.save();
    }
}
const RoleModel = Based(Role);

@suite("Basie")
class WithMetadata {
    // Setup database.
    async before() {
        await Database.connect(":memory:");
    }

    async after() {
        await Database.close();
    }

    @test
    "throws on invalid field type"() {
        expect(() => {
            abstract class Foo extends Basie {
                @field
                object: WithMetadata;
            }
        }).to.throw("Can only have string, number and boolean types in a @field.");

        expect(() => {
            abstract class Foo extends Basie {
                @field
                object: number;
            }
        }).to.not.throw("Can only have string, number and boolean types in a @field.");
    }
    
    @test
    "throws on invalid children type"() {
        expect(() => {
            abstract class Foo extends Basie {
                @children(p => <any>null)
                object: WithMetadata;
            }
        }).to.throw("Expected type of @children field to be an array,");

        expect(() => {
            abstract class Foo extends Basie {
                @children(p => <any>null)
                object: string[];
            }
        }).to.not.throw("Expected type of @children field to be an array,");
    }

    @test
    "throws when attempting to use id as field name"() {
        expect(() => {
            abstract class Foo extends Basie {
                @field
                id: number;
            }
        }).to.throw("`id` is a reserved column name");
    }

    @test
    "throws when template class has a constructor"() {
        expect(() => {
            abstract class Foo extends Basie {
                constructor(a: number, b: string) { super(); }
            }
            Based(Foo);
        }).to.throw("Basie classes cannot have a custom constructor");
    }

    @test
    "can create a new table"() {
        return UserModel.createTable();    
    }

    @test
    "can drop a table"() {
        return UserModel.dropTable();
    }

    @test
    "with no fields"() {
        abstract class Foo extends Basie {}
        const FooModel = Based(Foo);

        return FooModel.createTable(); // this should not fail.
    }

    @test
    async "save"() {
        await UserModel.createTable();
        await RoleModel.createTable();

        const u = new UserModel();
        u.name = "Thijs";
        u.age = 17;

        expect(await UserModel.all()).to.have.length(0);
        expect(u.id).to.equal(undefined);
        await u.save();
        expect(await UserModel.all()).to.have.length(1);
        expect(u.id).to.equal(1);
        u.name = "Willem";
        await u.save();
        expect(await UserModel.all()).to.have.length(1);
    }

    @test
    async "save throws on undefined members"() {
        await UserModel.createTable();
        await RoleModel.createTable();

        const u = new UserModel();
        u.age = 17;

        expect(() => {
            u.save()
        }).to.throw("Trying to save() a document with null or undefined members");
    }

    @test
    async "destroy"() {
        await User.setup();

        expect(await UserModel.all()).to.have.length(2);
        await (await UserModel.first())!.destroy();
        expect(await UserModel.all()).to.have.length(1);
        await (await UserModel.first())!.destroy();
        expect(await UserModel.all()).to.have.length(0);

        const newUser = new UserModel();
        await newUser.destroy(); // no-op
    }

    @test
    async "find"() {
        await User.setup();

        const u = (await UserModel.first())!;
        const ret = await UserModel.find(u.id);
        expect(ret).to.not.equal(undefined);
        expect(ret!.name).to.equal(u.name);
        expect(ret!.age).to.equal(u.age);
        expect(ret!.id).to.equal(u.id);
    }

    @test
    async "first"() {
        await User.setup();

        const ret = await UserModel.first();
        expect(ret).to.not.equal(undefined);
        expect(ret!.name).to.equal("Thijs");
        expect(ret!.age).to.equal(17);
    }

    @test
    async "all"() {
        await User.setup();

        const ret = await UserModel.all();
        expect(ret).to.have.length(2);
        expect(ret[0].name).to.equal("Thijs");
        expect(ret[1].name).to.equal("Willem");
    }

    @test
    async "findBy"() {
        await User.setup();

        const noArgs = await UserModel.findBy();
        expect(noArgs).to.not.equal(undefined);

        const noArgs2 = await UserModel.findBy({});
        expect(noArgs2).to.not.equal(undefined);

        const ret = await UserModel.findBy({ name: "Thijs" });
        expect(ret).to.not.equal(undefined);
        expect(ret!.name).to.equal("Thijs");
        expect(ret!.age).to.equal(17);

        const none = await UserModel.findBy({ name: "Thijs", age: 18 });
        expect(none).to.equal(undefined);
    }

    @test
    async "where"() {
        await User.setup();

        const noArgs = await UserModel.where();
        expect(noArgs.length).to.be.above(0);

        const noArgs2 = await UserModel.where([]);
        expect(noArgs2.length).to.be.above(0);

        let ret = await UserModel.where({ name: "Thijs" });
        expect(ret).to.have.length(1);

        ret = await UserModel.where({ age: 17 });
        expect(ret).to.have.length(2);

        ret = await UserModel.where("name LIKE ?", "%i%");
        expect(ret).to.have.length(2);
    }

    @test
    async "count"() {
        await User.setup();

        expect(await UserModel.count()).to.equal(2);
        expect(await UserModel.count({ name: "Thijs" })).to.equal(1);
        expect(await UserModel.count("name LIKE ?", "%i%")).to.equal(2);
    }

    @test
    async "child models"() {
        await User.setup();
        await Role.addRole((await UserModel.first())!, "Test Role");

        const user = (await UserModel.first())!;
        expect(user.roles).to.have.length(1);
        expect(user.roles[0].name).to.equal("Test Role");
        expect(user.roles[0].owner).to.equal(user.id);
    }

    @test
    async "throws on ID modification"() {
        await User.setup();

        // Cast to any is needed for the readonly to disappear.
        const user: any = await UserModel.first();
        expect(() => {
            user.id = 10;
        }).to.throw("Cannot manually set the ID");
    }

    @test
    async "throws on children modification"() {
        await User.setup();
        await Role.addRole((await UserModel.first())!, "Test Role");

        const user = (await UserModel.first())!;
        expect(() => {
            user.roles = [];
        }).to.throw("Writing to children does not do anything");

        expect(() => {
            "use strict";
            user.roles[0] = new RoleModel();
        }).to.throw("Cannot assign to read only property");
    }

    @test
    async "deleted objects are poisoned"() {
        await User.setup();

        const user = (await UserModel.first())!;
        await user.destroy();

        expect(() => {
            user.save();
        }).to.throw("This object was deleted");

        expect(() => {
            user.destroy();
        }).to.throw("This object was deleted");

        expect(() => {
            user.id;
        }).to.throw("This object was deleted");

        expect(() => {
            user.name;
        }).to.throw("This object was deleted");

        expect(() => {
            user.name = "Foo";
        }).to.throw("This object was deleted");

        expect(() => {
            user.roles;
        }).to.throw("This object was deleted");
    }

    @test
    async "booleans are stored as numbers"() {
        abstract class Foo extends Basie {
            @field
            value: boolean;
        }
        const FooModel = Based(Foo);
        await FooModel.createTable();

        const x = new FooModel();
        x.value = true;
        await x.save();

        const val = (await FooModel.first())!;
        expect(val).to.not.equal(undefined);
        expect(val!.value).to.equal(1);

        val!.value = false;
        expect(val!.value).to.equal(0);
    }

    @test
    async "toJSON gives expected results"() {
        await User.setup();

        let u = (await UserModel.first())!;
        expect(JSON.stringify(u)).to.equal(`{"id":1,"name":"Thijs","age":17,"roles":[]}`);

        await Role.addRole(u, "Cool");
        u = (await UserModel.first())!;
        expect(JSON.stringify(u)).to.equal(`{"id":1,"name":"Thijs","age":17,"roles":[{"id":1,"name":"Cool","user_id":1}]}`);
    }
}