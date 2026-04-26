import { LanguageModelRegistry, LanguageModelStatus, TokenUsageService } from '@theia/ai-core';
import { AnthropicLanguageModelsManager, AnthropicModelDescription } from '../common';
export declare class AnthropicLanguageModelsManagerImpl implements AnthropicLanguageModelsManager {
    protected _apiKey: string | undefined;
    protected _proxyUrl: string | undefined;
    protected readonly languageModelRegistry: LanguageModelRegistry;
    protected readonly tokenUsageService: TokenUsageService;
    get apiKey(): string | undefined;
    createOrUpdateLanguageModels(...modelDescriptions: AnthropicModelDescription[]): Promise<void>;
    removeLanguageModels(...modelIds: string[]): void;
    setApiKey(apiKey: string | undefined): void;
    setProxyUrl(proxyUrl: string | undefined): void;
    /**
     * Returns the status for a language model based on the presence of an API key or custom url.
     */
    protected calculateStatus(modelDescription: AnthropicModelDescription, effectiveApiKey: string | undefined): LanguageModelStatus;
}
//# sourceMappingURL=anthropic-language-models-manager-impl.d.ts.map