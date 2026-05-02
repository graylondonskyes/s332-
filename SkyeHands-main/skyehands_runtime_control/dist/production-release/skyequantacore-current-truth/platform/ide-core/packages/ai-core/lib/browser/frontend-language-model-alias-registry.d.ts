import { Event } from '@theia/core';
import { LanguageModelAlias, LanguageModelAliasRegistry } from '../common/language-model-alias';
import { PreferenceService } from '@theia/core/lib/common';
export declare class DefaultLanguageModelAliasRegistry implements LanguageModelAliasRegistry {
    protected aliases: LanguageModelAlias[];
    protected readonly onDidChangeEmitter: any;
    readonly onDidChange: Event<void>;
    protected readonly preferenceService: PreferenceService;
    protected readonly _ready: any;
    get ready(): Promise<void>;
    protected init(): void;
    addAlias(alias: LanguageModelAlias): void;
    removeAlias(id: string): void;
    getAliases(): LanguageModelAlias[];
    resolveAlias(id: string): string[] | undefined;
    /**
     * Set the selected model for the given alias id.
     * Updates the alias' selectedModelId to the given modelId, persists, and fires onDidChange.
     */
    selectModelForAlias(aliasId: string, modelId: string): void;
    /**
     * Load aliases from the persisted setting
     */
    protected loadFromPreference(): void;
    /**
     * Persist the current aliases and their selected models to the setting
     */
    protected saveToPreference(): void;
}
//# sourceMappingURL=frontend-language-model-alias-registry.d.ts.map