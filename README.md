# Basie [![Build Status](https://travis-ci.org/molenzwiebel/Basie.svg?branch=master)](https://travis-ci.org/molenzwiebel/Basie) [![Coverage Status](https://coveralls.io/repos/github/molenzwiebel/Basie/badge.svg)](https://coveralls.io/github/molenzwiebel/Basie) [![npm version](https://badge.fury.io/js/basie.svg)](https://badge.fury.io/js/basie)

A TypeScript Node package that provides a fluent semi-typesafe SQL query builder akin to the one shipped with Laravel.

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