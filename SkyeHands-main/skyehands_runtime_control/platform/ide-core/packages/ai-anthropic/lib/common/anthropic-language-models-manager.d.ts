export declare const ANTHROPIC_LANGUAGE_MODELS_MANAGER_PATH = "/services/anthropic/language-model-manager";
export declare const AnthropicLanguageModelsManager: unique symbol;
export interface AnthropicModelDescription {
    /**
     * The identifier of the model which will be shown in the UI.
     */
    id: string;
    /**
     * The model ID as used by the Anthropic API.
     */
    model: string;
    /**
     * The Anthropic API compatible endpoint where the model is hosted. If not provided the default Anthropic endpoint will be used.
     */
    url?: string;
    /**
     * The key for the model. If 'true' is provided the global Anthropic API key will be used.
     */
    apiKey: string | true | undefined;
    /**
     * Indicate whether the streaming API shall be used.
     */
    enableStreaming: boolean;
    /**
     * Indicate whether the model supports prompt caching.
     */
    useCaching: boolean;
    /**
     * Maximum number of tokens to generate. Default is 4096.
     */
    maxTokens?: number;
    /**
     * Maximum number of retry attempts when a request fails. Default is 3.
     */
    maxRetries: number;
}
export interface AnthropicLanguageModelsManager {
    apiKey: string | undefined;
    setApiKey(key: string | undefined): void;
    setProxyUrl(proxyUrl: string | undefined): void;
    createOrUpdateLanguageModels(...models: AnthropicModelDescription[]): Promise<void>;
    removeLanguageModels(...modelIds: string[]): void;
}
//# sourceMappingURL=anthropic-language-models-manager.d.ts.map