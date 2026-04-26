import { CommandPromptFragmentMetadata } from '../common';
/**
 * Result of parsing a template file that may contain YAML front matter
 */
export interface ParsedTemplate {
    /** The template content (without front matter) */
    template: string;
    /** Parsed metadata from YAML front matter, if present */
    metadata?: CommandPromptFragmentMetadata;
}
/**
 * Type guard to check if an object is valid TemplateMetadata
 */
export declare function isTemplateMetadata(obj: unknown): obj is CommandPromptFragmentMetadata;
/**
 * Parses a template file that may contain YAML front matter.
 *
 * Front matter format:
 * ```
 * ---
 * isCommand: true
 * commandName: mycommand
 * commandDescription: My command description
 * commandArgumentHint: <arg1> <arg2>
 * commandAgents:
 *   - Agent1
 *   - Agent2
 * ---
 * Template content here
 * ```
 *
 * @param fileContent The raw file content to parse
 * @returns ParsedTemplate containing the template content and optional metadata
 */
export declare function parseTemplateWithMetadata(fileContent: string): ParsedTemplate;
//# sourceMappingURL=prompttemplate-parser.d.ts.map