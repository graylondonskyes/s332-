/**
 * The standard filename for skill definition files.
 */
export declare const SKILL_FILE_NAME = "SKILL.md";
/**
 * Represents the YAML frontmatter metadata from a SKILL.md file.
 */
export interface SkillDescription {
    /** Unique identifier, must match directory name, lowercase kebab-case with digits allowed */
    name: string;
    /** Human-readable description of the skill, max 1024 characters */
    description: string;
    /** Optional SPDX license identifier */
    license?: string;
    /** Optional version constraint for compatibility */
    compatibility?: string;
    /** Optional key-value pairs for additional metadata */
    metadata?: Record<string, string>;
    /** Optional experimental feature: list of allowed tool IDs */
    allowedTools?: string[];
}
export declare namespace SkillDescription {
    /**
     * Type guard to check if an unknown value is a valid SkillDescription.
     * Validates that required fields exist and have correct types.
     */
    function is(entry: unknown): entry is SkillDescription;
    /**
     * Compares two SkillDescription objects for equality based on name.
     */
    function equals(a: SkillDescription, b: SkillDescription): boolean;
}
/**
 * Full skill representation including location.
 */
export interface Skill extends SkillDescription {
    /** Absolute file path to the SKILL.md file */
    location: string;
}
/**
 * Validates if a skill name follows the required format.
 * Valid names are lowercase kebab-case with digits allowed.
 * No leading/trailing/consecutive hyphens.
 *
 * @param name The skill name to validate
 * @returns true if the name is valid, false otherwise
 */
export declare function isValidSkillName(name: string): boolean;
/**
 * Validates a SkillDescription against all constraints.
 *
 * @param description The skill description to validate
 * @param directoryName The name of the directory containing the SKILL.md file
 * @returns Array of validation error messages, empty if valid
 */
export declare function validateSkillDescription(description: SkillDescription, directoryName: string): string[];
/**
 * Parses a SKILL.md file content, extracting YAML frontmatter metadata and markdown content.
 * @param content The raw file content
 * @returns Object with parsed metadata (if valid) and the markdown content
 */
export declare function parseSkillFile(content: string): {
    metadata: SkillDescription | undefined;
    content: string;
};
/**
 * Combines skill directories with proper priority ordering.
 * Workspace directory has highest priority, followed by configured directories, then default.
 * First directory wins on duplicates.
 */
export declare function combineSkillDirectories(workspaceSkillsDir: string | undefined, configuredDirectories: string[], defaultSkillsDir: string | undefined): string[];
//# sourceMappingURL=skill.d.ts.map