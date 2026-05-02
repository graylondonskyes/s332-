import { type MinimatchOptions } from 'minimatch';
import type URI from '@theia/core/lib/common/uri';
/**
 * Normalizes glob patterns to be consistent with ripgrep behavior.
 *
 * Examples of transformations:
 * - "*.js" -> "**\/*.js" (make non-root patterns match anywhere)
 * - "src/" -> "src\/**" (directory patterns match all contents)
 * - "!*.log" -> "!**\/*.log" (negation patterns)
 * - "src/**\/**\/file.js" -> "src/**\/file.js" (collapse repeated double-star patterns)
 *
 * @param glob - The glob pattern to normalize
 * @returns The normalized glob pattern
 */
export declare function normalizeGlob(glob: string): string;
/**
 * Checks if a text matches any of the minimatch patterns
 * @param text - The text to check
 * @param patterns - The patterns to check
 * @returns True if the text matches any of the patterns, false otherwise
 */
export declare function matchesPattern(text: string, patterns: string[], opts?: MinimatchOptions): boolean;
/**
 * Creates a new ignore pattern matcher for managing ignore patterns.
 * @returns An object with add and ignores methods
 */
export declare function createIgnoreMatcher(): {
    add: (patterns: string | string[]) => void;
    ignores: (path: string) => boolean;
};
/**
 * Processes ignore files (.gitignore, .ignore, .rgignore) in a directory.
 * @param dir - The directory URI to process
 * @param read - Function to read the ignore file content
 * @returns Array of processed ignore patterns relative to the directory contains that ignore file
 */
export declare function getIgnorePatterns(dir: URI, read: (uri: URI) => Promise<string>): Promise<string[]>;
//# sourceMappingURL=file-search.d.ts.map