import { BasiePrototype, Basie, B } from "./types";

// Polyfill the decorator metadata types if enabled and no reflect-metadata.
const types: Map<{}, Map<string, Function>> = new Map();
if (typeof Reflect !== "undefined" && !(<any>Reflect).metadata) {
    (<any>Reflect).metadata = (type: string, constructor: Function) => {
        return (proto: BasiePrototype, fieldName: string) => {
            if (type !== "design:type") return;
            
            if (!types.has(proto)) types.set(proto, new Map());
            types.get(proto)!.set(fieldName, constructor);
        };
    };
}

// Uses the reflect-metadata API if available, otherwise looks up the type in the polyfill map.
// Returns undefined if there is no type, or if decorator metadata is disabled.
function getType(proto: any, fieldName: string): Function | undefined {
    /* istanbul ignore if: We test without reflect-metadata */
    if (typeof Reflect !== "undefined" && (<any>Reflect).getMetadata)
        return (<any>Reflect).getMetadata("design:type", proto, fieldName);
    
    const map = types.get(proto);
    if (!map) return;

    return map.get(fieldName);
}

/**
 * Used to indicate that a field should be included in the database model.
 * Optionally takes a name argument that determines the name of the column
 * in the database. The property annotated by @field can only be a string,
 * number or boolean. All other properties should be constructed from these
 * base types. `id` is an invalid field and/or column name, since this is already
 * internally used by Basie. The call to Based(Template) will automatically add
 * this field, so it need not be described using @field.
 * 
 * Example usage:
 * @example
 * @field
 * myField: number; // column name myField, type is REAL NOT NULL.
 * 
 * @field("user_id")
 * owner: number; // column name user_id, type is REAL NOT NULL.</code></pre>
 */
export function field(name: string): (proto: BasiePrototype, fieldName: string) => void;
export function field(proto: BasiePrototype, fieldName: string): void;
export function field(nameOrProto: string | BasiePrototype, fieldName?: string) {
    if (typeof nameOrProto === "string") {
        return fieldImplementation.bind(this, nameOrProto);
    }

    fieldImplementation(undefined, nameOrProto, fieldName!);
}

/**
 * Private implementation for {@link field}.
 */
function fieldImplementation(name: string | undefined, proto: BasiePrototype, fieldName: string) {
    // If we have a type, validate it.
    const fieldType = getType(proto, fieldName);
    if (fieldType && (<any>[String, Number, Boolean]).indexOf(fieldType) === -1) {
        throw new Error("Can only have string, number and boolean types in a @field. You attempted to use " + fieldType.name);
    }

    // Add metadata info.
    const columnName = name || fieldName;
    if (columnName === "id") throw new Error("`id` is a reserved column name and is automatically added by Basie");
    proto.__basieFields = proto.__basieFields || [];
    proto.__basieFields.push({ columnName, fieldName, fieldType });

    // Redirect queries to __props, trap if __poisoned.
    Object.defineProperty(proto, fieldName, {
        get(this: Basie) {
            if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");
            return this.__props[columnName];
        },
        set(this: Basie, val: any) {
            if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");
            if (typeof val === "boolean") val = val ? 1 : 0; // coerce to number if boolean
            this.__props[columnName] = val;
        }
    });
}

/**
 * Used to indicate a one-to-many relationship with rows from a different table.
 * Upon loading, this will automatically fetch all rows from the different table
 * where the foreign key matches the ID of the "owning" object. A foreign key can
 * be given, or is "<table name>_id" by default. The type of the annotated field
 * should be B<Template>[]. If decorator metadata is on, this will be validated at
 * runtime. The annotation takes a type function to ensure this works regardless of
 * initialization order. The convention for this is `@children(model => ResultOfBasedCall)`.
 * Note that the property annotated by this annotation will be frozen and cannot be
 * re-assigned. The array is populated upon loading and will not reflect changes in
 * the meantime. Changing the array and then calling save() will not propagate changes
 * to the sub-documents. It is recommended to "use strict", so that attempting to modify
 * this frozen array will throw an error. Reassigning the property will also throw.
 * 
 * Example usage:
 * @example
 * class RoleTemplate {
 *  @field
 *  name: string;
 * 
 *  @field
 *  owner: number;
 * }
 * const Role = Based(RoleTemplate);
 * 
 * class UserTemplate {
 *  @children(type => Role, "owner") // upon loading, all `Role`s WHERE owner = <owner id> will be loaded.
 *  roles: B<RoleTemplate>[];
 * }
 * const User = Based(UserTemplate);
 */
export function children<A extends B<any>>(type: (x: any) => A, foreignKey?: string) {
    return function(proto: BasiePrototype, fieldName: string) {
        // Validate field type, if we can.
        const fieldType = getType(proto, fieldName);
        if (fieldType && fieldType !== Array) {
            throw new Error("Expected type of @children field to be an array, instead got " + fieldType.name);
        }

        proto.__basieChildFields = proto.__basieChildFields || [];
        proto.__basieChildFields.push({ foreignKey, fieldName, foreignType: type });

        // Generate __props getter, throwing setter.
        Object.defineProperty(proto, fieldName, {
            get(this: Basie) {
                if (this.__poisoned) throw new Error("This object was deleted and can no longer be used.");
                return this.__props[fieldName];
            },
            set(this: Basie, val: any) {
                throw new Error("Writing to children does not do anything, and is thus prohibited to prevent confusion.");
            }
        });
    };
}