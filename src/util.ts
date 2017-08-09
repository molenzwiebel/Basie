
import pluralize = require("pluralize");

/**
 * Returns the pluralized table name for the specified string.
 * This trims an optional leading space, then converts the PascalCase
 * to pascal_case and pluralizes it. Converts _LeaderboardCategory into
 * leaderboard_categories for example.
 */
export function getTableName(name: string) {
    return pluralize(name.replace(/^_/, "").replace(/(?:^|\.?)([A-Z])/g, (_, x) => "_" + x.toLowerCase()).replace(/^_/, ""));
}

/**
 * Returns the automatic foreign key name for the specified string.
 * This trims an optional leading space, then converts the PascalCase
 * to pascal_case and appends _id. Converts _LeaderboardCategory into
 * leaderboard_category_id for example.
 */
export function getForeignKey(name: string) {
    return name.replace(/^_/, "").replace(/(?:^|\.?)([A-Z])/g, (_, x) => "_" + x.toLowerCase()).replace(/^_/, "") + "_id";
}

/**
 * Returns the table name for a pivot table between the two specified tables.
 * This takes the table names of the specified models, then sorts them alphabetically
 * and joins them with an underscore.
 */
export function getPivotTableName(a: string, b: string) {
    return [getTableName(a), getTableName(b)].sort((a, b) => a.localeCompare(b)).join("_");
}