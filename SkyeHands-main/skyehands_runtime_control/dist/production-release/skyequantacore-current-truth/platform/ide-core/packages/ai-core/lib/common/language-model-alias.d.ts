import { Event } from '@theia/core';
/**
 * Represents an alias for a language model, allowing fallback and selection.
 */
export interface LanguageModelAlias {
    /**
     * The unique identifier for the alias.
     */
    id: string;
    /**
     * The list of default model IDs to use if no selectedModelId is set.
     * Ordered by priority. The first entry also serves as fallback.
     */
    defaultModelIds: string[];
    /**
     * A human-readable description of the alias.
     */
    description?: string;
    /**
     * The currently selected model ID, if any.
     */
    selectedModelId?: string;
}
export declare const LanguageModelAliasRegistry: unique symbol;
/**
 * Registry for managing language model aliases.
 */
export interface LanguageModelAliasRegistry {
    /**
     * Promise that resolves when the registry is ready for use (preferences loaded).
     */
    ready: Promise<void>;
    /**
     * Event that is fired when the alias list changes.
     */
    onDidChange: Event<void>;
    /**
     * Add a new alias or update an existing one.
     */
    addAlias(alias: LanguageModelAlias): void;
    /**
     * Remove an alias by its id.
     */
    removeAlias(id: string): void;
    /**
     * Get all aliases.
     */
    getAliases(): LanguageModelAlias[];
    /**
     * Resolve an alias or model id to a prioritized list of model ids.
     * If the id is not an alias, returns [id].
     * If the alias exists and has a selectedModelId, returns [selectedModelId].
     * If the alias exists and has no selectedModelId, returns defaultModelIds.
     * If the alias does not exist, returns undefined.
     */
    resolveAlias(id: string): string[] | undefined;
}
//# sourceMappingURL=language-model-alias.d.ts.map