# Basie [![Build Status](https://travis-ci.org/molenzwiebel/Basie.svg?branch=master)](https://travis-ci.org/molenzwiebel/Basie) [![Coverage Status](https://coveralls.io/repos/github/molenzwiebel/Basie/badge.svg)](https://coveralls.io/github/molenzwiebel/Basie) [![npm version](https://badge.fury.io/js/basie.svg)](https://badge.fury.io/js/basie)

A TypeScript Node package that provides a fluent semi-typesafe SQL query builder akin to the one shipped with Laravel. Supports sqlite (using [sqlite3](https://github.com/mapbox/node-sqlite3)), MySQL (using [mysql2](https://github.com/sidorares/node-mysql2)) and PostgreSQL (using [pg](https://github.com/brianc/node-postgres)). Find the documentation [here](https://docs.molenzwiebel.xyz/basie).

## Example
```typescript
import Basie, { BaseModel, R, A } from "basie";

class _User extends BaseModel {
    public name: string;
    public age: number;

    public phones: A<Phone> = this.hasMany(Phone);
}
const User = Basie.wrap<_User>()(_User);
type User = _User;

class _Phone extends BaseModel {
    public number: string;
    public user_id: number;

    public user: R<User> = this.belongsTo(User);
}
const Phone = Basie.wrap<_Phone>()(_Phone);
type Phone = _Phone;

// Fluent querying on objects.
const allUsersAbove20 = await User.where("age", ">", 20).get();

// Complex querying supported:
const complex = await User.where("age", ">", 20).orWhere(nested => {
    nested.where("name", "LIKE", "%a%");
    nested.orWhere("name", "LIKE", "%A%");
}).limit(10).orderByDesc("age").get();
// 'SELECT * FROM users WHERE age > ? OR (name LIKE ? OR name LIKE ?) ORDER BY age DESC LIMIT ?'

// Methods directly on the object.
const user = new User();
user.name = "Thijs";
user.age = 17;
await user.save(); // inserts
user.age = 18;
await user.save(); // updates
await user.delete(); // deletes

// Lazy relationships.
const phones = await user.phones();
console.assert(phones === await user.phones(), "Not lazy");

// Allows relationships to be further narrowed down.
const longPhones = await user.phones.select("LEN(number) as number_length").where("number_length", ">=", 10).get();
// 'SELECT LEN(number) as number_length FROM phones WHERE user_id = ? AND number_length >= ?'
```

## Features
- **Fluent Querying Interface**: QueryBuilder is a fluent querying builder interface that attempts to be as type-safe as possible. This means that `where(nonexistentKey, 10)` will fail, and that `where("is_admin", "true")` won't compile if `is_admin` is supposed to be a boolean.
- **Easily Managable Objects**: Simply call `save()` and `delete()` on objects to either insert, update or delete the specific model.

## Limitations
- **Only string, boolean and number fields are supported.** Basie does not actually query your database for the scheme, so it doesn't know the types of your database columns. Only strings, numbers and booleans will be converted properly. For all other values, you can use custom getters and setters to wrap a value.
- **Does not create tables.** Basie only queries tables and simply assumes that your model matches the database layout.
- **Tables are required to have an id column.** Basie tracks documents by their id, and it does not support changing the name or type of the ID column.
- **Relations are read-only.** You have to manually fiddle with id columns to change relationships.

## Usage
For a complete overhead view of all methods available, it is recommended you check out [the documentation](https://docs.molenzwiebel.xyz/basie). The next few sections describe some common usecases and gotchas.

### Configuring the Database
Basie supports SQLite, MySQL and PostgreSQL. Simply import the static Basie instance and call the appropriate method to configure Basie to use that database:
```typescript
import Basie from "basie";

// SQLite.
import { Database } from "sqlite3";
const db = new Database("path_to_database.db", error => {
    if (error) throw new Error(); // handle error.
    Basie.sqlite(db);
});

// MySQL
import * as mysql from "mysql2";
const connection = await mysql.createConnection(<any>{
    user: databaseUsername,
    password: databasePassword,
    database: databaseName,
    host: databaseHost,
    port: databasePort,
    decimalNumbers: true // recommended to ensure that you receive numbers as numbers instead of strings
});
Basie.mysql(connection);

// PostgreSQL
import * as pg from "pg";
const pool = new pg.Pool({
    user: databaseUsername,
    password: databasePassword,
    database: databaseName,
    host: databaseHost,
    port: databasePort,
    max: 10,
    idleTimeoutMillis: 30000
});
pg.types.setTypeParser(20, parseInt); // convert strings to numbers (int8)
pg.types.setTypeParser(1700, parseFloat); // convert decimal strings to numbers (numeric)
Basie.postgres(pool);
```

### Models, Methods and Computed Properties
Your models are simple TypeScript classes, which means that they support methods and computed properties. Basie will ensure that whenever a model instance gets loaded from the database, it will have the appropriate prototype.
```typescript
class _User extends BaseModel {
    public name: string;
    public lastChangeTimestamp: number;

    get lastChange(): Date {
        return new Date(this.lastChangeTimestamp);
    }

    set lastChange(newDate: Date) {
        this.lastChangeTimestamp = newDate.getTime();
    }

    greet() {
        console.log("Hello, I'm " + this.name);
    }
}
const User = Basie.wrap<_User>()(_User);
type User = _User;
```

### Relations
For a full overview of all relations, please check the [documentation](https://docs.molenzwiebel.xyz/basie). Relations work similar to how Laravel's Eloquent handles relations. Do note that foreign keys will need to be present on objects.

```typescript
import Basie, { BaseModel, A, R } from "basie";

class _User extends BaseModel {
    public name: string;
    public age: number;

    public readonly phones: A<Phone> = this.hasMany(Phone);
}
const User = Basie.wrap<_User>()(_User);
type User = _User;

class _Phone extends BaseModel {
    public number: string;
    public user_id: number;

    public readonly user: R<User> = this.belongsTo(User);
}
const Phone = Basie.wrap<_Phone>()(_Phone);
type Phone = _Phone;
```

Relations are lazy and return a promise. Calling a relation without `()` will instead return a query builder that can be refined further:
```typescript
const phones = await user.phones(); // Phone.where("user_id", user.id).all()
const phoneQueryBuilder = user.phones; // Phone.where("user_id", user.id). Can be further refined.
```

## Development
Begin by running `npm install` or `yarn install`. Use `npm run watch` (or `yarn watch`) to start the TypeScript compilation service. Tests can be ran using `npm test` or `yarn test`. Pull requests are welcome! ;)

## License
[MIT](http://opensource.org/licenses/MIT)