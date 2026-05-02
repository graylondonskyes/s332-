import { ContentReplacer, Replacement } from './content-replacer';
export declare class ContentReplacerV2Impl implements ContentReplacer {
    /**
     * Applies a list of replacements to the original content using a multi-step matching strategy with improved flexibility.
     * @param originalContent The original file content.
     * @param replacements Array of Replacement objects.
     * @returns An object containing the updated content and any error messages.
     */
    applyReplacements(originalContent: string, replacements: Replacement[]): {
        updatedContent: string;
        errors: string[];
    };
    /**
     * Normalizes line endings to LF
     */
    private normalizeLineEndings;
    /**
     * Finds matches using multiple strategies with increasing flexibility
     */
    private findMatches;
    /**
     * Finds all exact matches of a substring within a string.
     */
    private findExactMatches;
    /**
     * Finds matches after normalizing line endings
     */
    private findNormalizedLineEndingMatches;
    /**
     * Maps a position in normalized content back to the original content
     */
    private mapNormalizedPositionToOriginal;
    /**
     * Attempts to find matches by trimming whitespace from lines (single line only, for backward compatibility)
     */
    private findLineTrimmedMatches;
    /**
     * Finds matches using fuzzy multi-line comparison with trimmed lines
     */
    private findFuzzyMultilineMatches;
    /**
     * Calculates the starting index of a specific line number in the content.
     */
    private getLineStartIndex;
    /**
     * Calculates the ending index of a specific line number in the content (including the line).
     */
    private getLineEndIndex;
    /**
     * Replaces a single match while preserving indentation
     */
    private replaceSingleMatch;
    /**
     * Replaces all matches
     */
    private replaceAllMatches;
    /**
     * Preserves the indentation from the original content when applying the replacement
     */
    private preserveIndentation;
    /**
     * Converts line endings in content to the specified line ending style
     */
    private convertLineEndings;
    /**
     * Truncates content for error messages to avoid overly long error messages
     */
    private truncateForError;
}
//# sourceMappingURL=content-replacer-v2-impl.d.ts.map