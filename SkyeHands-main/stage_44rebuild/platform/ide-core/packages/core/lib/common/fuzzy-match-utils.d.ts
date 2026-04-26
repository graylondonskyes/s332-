/**
 * Returns the index of the first case-insensitive substring match of `pattern` in `text`,
 * or `-1` if `pattern` is not a substring. Returns `0` for an empty pattern.
 */
export declare function findSubstringIndex(text: string, pattern: string): number;
export declare function hasSubstringMatch(text: string, pattern: string): boolean;
/**
 * Tests whether `pattern` is a "prefix match" for `text`, accounting for punctuation-separated segments.
 *
 * The pattern is split on punctuation into query parts. The text is split on punctuation into segments.
 * It is a prefix match when the first query part matches the start of segment 0, and each subsequent
 * query part matches the start of a later segment, in order.
 *
 * Examples:
 * - `hasPrefixMatch("workspace-server", "works-ser")` → true
 * - `hasPrefixMatch("backend-workspace-service", "works-ser")` → false (first segment doesn't match)
 * - `hasPrefixMatch("fontSize", "font")` → true (single-part prefix)
 */
export declare function hasPrefixMatch(text: string, pattern: string): boolean;
/**
 * Returns a numeric rank for how well `pattern` matches `text`:
 * - 0: prefix match (best)
 * - 1: substring match
 * - 2: fuzzy-only match (worst)
 */
export declare function matchRank(text: string, pattern: string): number;
//# sourceMappingURL=fuzzy-match-utils.d.ts.map