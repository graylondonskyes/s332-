/** Should match the one from VariableResolverService. The format is `{{variableName:arg}}`. We allow {{}} and {{{}}} but no mixtures */
export declare const PROMPT_VARIABLE_TWO_BRACES_REGEX: RegExp;
export declare const PROMPT_VARIABLE_THREE_BRACES_REGEX: RegExp;
export declare function matchVariablesRegEx(template: string): RegExpMatchArray[];
/** Match function/tool references in the prompt. The format is `~{functionId}`. */
export declare const PROMPT_FUNCTION_REGEX: RegExp;
export declare function matchFunctionsRegEx(template: string): RegExpMatchArray[];
/** Regex matching YAML front matter delimited by `---` */
export declare const FRONT_MATTER_REGEX: RegExp;
/**
 * Strips YAML front matter from a template string, returning only the body.
 * If no front matter is present the original string is returned unchanged.
 */
export declare function stripFrontMatter(template: string): string;
//# sourceMappingURL=prompt-service-util.d.ts.map