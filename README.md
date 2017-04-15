# Basie [![Build Status](https://travis-ci.org/molenzwiebel/Basie.svg?branch=master)](https://travis-ci.org/molenzwiebel/Basie)

A TypeScript package for when you need simple persistence to a database with a fluent querying method and easy-to-understand schemantics. Requires Node 6.4 and TypeScript 2.2 or higher.

## Example
```typescript
import { Basie, Based, field } from "basie";

abstract class Role extends Basie {
    @field
    name: string;

    @field("user_id") // custom column name
    owner: number;
}
const RoleModel = Based(Role);

abstract class User extends Basie {
    @field
    name: string;

    @field
    email: string;

    @field
    age: number;

    @children(model => RoleModel)
    roles: Role[]; // finds all roles with user_id set to the id of the user.
}
const UserModel = Based(User); // table name is "user"

// Get all users:
const users = await UserModel.all();

// Get the user with ID 1
const myUser = await UserModel.find(1);

// Edit the user...
myUser!.name = "Thijs";
await myUser!.save();

// Or delete it.
await myUser!.destroy();
myUser!.name; // This will throw, since the object no longer exists.

// Create a new user.
const newUser = new UserModel();
newUser.name = "John";
newUser.email = "john@doe.com";
newUser.age = 20;
await newUser.save();

// Find the first user with the specified query (all type safe!):
const firstMatching = await UserModel.findBy({ age: 20 });

// Or do more advanced queries:
const allUsersUnder30 = await UserModel.where("age < ?", 30);
```

## Features
- **Fluent querying interface**: Static methods are exposed that allow easy access to the database tables. `Partial` from [TypeScript 2.1](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html) is used to guarantee type-safe `where` querying, and raw SQL queries are also exposed.
- **Easily managable objects**: Simply call `save()` or `destroy()` on an object to perform the appropriate actions.
- **Safety where possible**: Deleted objects are "poisoned", preventing you from accidentally using something that no longer exists. `@children` fields are made read-only, to prevent you from accidentally writing to the "snapshot" of the children. If `emitDecoratorMetadata` is turned on, fields are validated to ensure that only valid field types are used.

## Limitations
- **Only supports an SQLite database**. Since Basie was built for a simple way to add persistence, SQLite was chosen since it does not require a separate database process.
- **Only string, number and boolean fields are supported**. Since Basie also works without enabling `emitDecoratorMetadata`, it doesn't know about the types of the fields and hence cannot perform automatic conversion. Basie only supports the types that SQLite supports. Custom getters/setters can be added that perform this conversion manually (see getting started).
- **One-to-many (@children) is read-only**. Writing to the children array and then saving the "owner" object doesn't propagate changes to the children. This was done to reduce code size, and any attempt to write to the children is blocked where possible.
- **Fixed id name and type**: Every Basie model has an `id` field of type `INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE`. This was done to make easier assumptions about the state of the object.
- **Not optimized for speed**: Since SQLite queries are cheap anyway, no large efforts are made to ensure that as little queries as possible are made. Each additional `@children` field adds a single query to be performed when loading the object (`Model.all()` where model has a single child field results in `1 + row_count * 1` queries). Queries are parallelized where possible.
- **Limited set of exposed queries**: Only `SELECT`, `UPDATE`, `CREATE TABLE`, `DROP TABLE`, and `SELECT COUNT(*)` queries are exposed. For all others, the raw `Database` class must be used.
- **Limited set of options**: Only the column name of a `@field` can be changed. There are no options for default values or nullable columns.

## Installation
First, install Basie using `npm install --save basie` (or `yarn add basie`). Also ensure that you have `experimentalDecorators` set to `true` in your `tsconfig.json`.
Basie does not require the `emitDecoratorMetadata` option, unless you want Basie to automatically create tables for you. If `emitDecoratorMetadata` is off and you attempt to call `Model.createTable()`, this will throw with the appropriate info.

Basie can tap into existing databases just fine. Simply connect to the appropriate database. If you want to create a new database if it does not yet exist, it is recommended to simply call `Model.createTable()` at startup (since this is a no-op if the table already exists).

## Usage
For a complete overhead of which methods are supported, it is recommended that you check out the extensive documentation in `types.ts`: [https://github.com/molenzwiebel/Basie/blob/master/src/types.ts](https://github.com/molenzwiebel/Basie/blob/master/src/types.ts). The next few sections describe some common usecases and gotchas.

### Configuring the database
The database first needs to be configured before any queries can be made. This is as easy as simply calling `Database.connect` before your first access to the database:
```typescript
import { Database } from "basie";

// The database will be created if it doesn't exist.
await Database.connect("./path_to_database.db");

// Should you want to swap databases at runtime.
await Database.close();
```

### Simple Models
If you only require simple fields to be present, simply creating an abstract class that extends `Basie` and marking the appropriate fields with `@field` is enough:
```typescript
// Extending basie adds the definitions for save() and destroy().
abstract class User extends Basie {
    // readonly id: number; is implicitly added

    // stored as `name TEXT`
    @field
    name: string;

    // stored as `differentColumnName REAL`
    @field("differentColumnName")
    age: number;
}
const UserModel = Based(User); // Based(User, "tableName") can be used for a custom table name.
```

At this point, `UserModel.find/all/first/where/findBy/count` can be used to query the database. `UserModel.createTable` can be used to create the table, if decorator metadata is enabled. Since `User` is abstract, `new UserModel()` is needed to create an instance (contrary to expectations though, this constructor call will return an instance of `User`, _not_ `UserModel`). As a rule of thumb, `UserModel` is used to create or query objects, while instances of `User` can manipulate a row.

### Methods and Computed Properties
Since the abstract class is still a normal TypeScript class, any methods can be added, as well as properties that are not saved to the database:
```typescript
abstract class User extends Basie {
    @field
    name: string;

    @field
    lastChangeTimestamp: number;

    // No date fields are supported, but you can add the conversion manually.
    get lastChange(): Date {
        return new Date(this.lastChangeTimestamp);
    }

    set lastChange(value: Date) {
        this.lastChangeTimestamp = value.getTime();
    }

    greet() {
        console.log("Hello, I'm " + this.name);
    }
}
```
Both the computed property and the `greet()` method will work as expected.

### One-to-many relations
Basie supports the `one -> many` side of a one-to-many (`has_many` in rails) relation. The `many -> one` direction is deliberately not implemented, since this would either require lazy loading, or would end up in an infinite loop (parent would load children, who would each load the parent, who would then load the children ad infinitum). Solving the loop would be possible for trivial cases, but this requires too much boilerplate for something that isn't too important (rarely does one need to get the parent without already having a reference to it). Also notable is that the children array is a snapshot of the other table when the row was queried, and as such is read-only and doesn't automatically update. The `@children` annotation takes a reference to the child model, as well as an optional foreign key:
```typescript
abstract class Role extends Basie {
    @field("user_id")
    owner: number; // id of the owner

    doSomething() {
        console.log("Boop");
    }
}
const RoleModel = Based(Role);

abstract class User extends Basie {
    @children(model => RoleModel)
    roles: Role[];
}
const UserModel = Based(User);

const user = await UserModel.first();
user.roles[0].doSomething(); // works as expected
console.log(user.id === user.roles[0].owner); // true

const len = user.roles.length;

const newRole = new RoleModel();
newRole.owner = user.id;
await newRole.save();

console.log(len === user.roles.length); // true, user.roles is a snapshot and doesn't automatically update.
user.roles.push(new RoleModel()); // throws, user.roles is a snapshot and changes are not reflected.
```

## Development
Begin by running `npm install` or `yarn install`. Use `npm run watch` (or `yarn watch`) to start the TypeScript compilation service. Tests can be ran using `npm test` or `yarn test`. Pull requests are welcome! ;)

## License
[MIT](http://opensource.org/licenses/MIT)