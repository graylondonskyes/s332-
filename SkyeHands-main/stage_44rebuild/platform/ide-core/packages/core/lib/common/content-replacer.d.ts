export interface Replacement {
    oldContent: string;
    newContent: string;
    multiple?: boolean;
}
export interface ContentReplacer {
    /**
     * Applies a list of replacements to the original content using a multi-step matching strategy.
     * @param originalContent The original file content.
     * @param replacements Array of Replacement objects.
     * @returns An object containing the updated content and any error messages.
     */
    applyReplacements(originalContent: string, replacements: Replacement[]): {
        updatedContent: string;
        errors: string[];
    };
}
export declare class ContentReplacerV1Impl implements ContentReplacer {
    /**
     * Applies a list of replacements to the original content using a multi-step matching strategy.
     * @param originalContent The original file content.
     * @param replacements Array of Replacement objects.
     * @param allowMultiple If true, all occurrences of each oldContent will be replaced. If false, an error is returned when multiple occurrences are found.
     * @returns An object containing the updated content and any error messages.
     */
    applyReplacements(originalContent: string, replacements: Replacement[]): {
        updatedContent: string;
        errors: string[];
    };
    /**
     * Finds all exact matches of a substring within a string.
     * @param content The content to search within.
     * @param search The substring to search for.
     * @returns An array of starting indices where the exact substring is found.
     */
    private findExactMatches;
    /**
     * Attempts to find matches by trimming whitespace from lines in the original content and the search string.
     * @param content The original content.
     * @param search The substring to search for, potentially with varying whitespace.
     * @returns An array of starting indices where a trimmed match is found.
     */
    private findLineTrimmedMatches;
    /**
     * Calculates the starting index of a specific line number in the content.
     * @param content The original content.
     * @param lineNumber The zero-based line number.
     * @returns The starting index of the specified line.
     */
    private getLineStartIndex;
    /**
     * Replaces the first occurrence of oldContent with newContent in the content.
     * @param content The original content.
     * @param oldContent The content to be replaced.
     * @param newContent The content to replace with.
     * @returns The content after replacement.
     */
    private replaceContentOnce;
    /**
     * Replaces all occurrences of oldContent with newContent in the content.
     * @param content The original content.
     * @param oldContent The content to be replaced.
     * @param newContent The content to replace with.
     * @returns The content after all replacements.
     */
    private replaceContentAll;
}
//# sourceMappingURL=content-replacer.d.ts.map