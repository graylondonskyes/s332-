import { Event } from '@theia/core';
import { LanguageModelMetaData } from './language-model';
import { TokenUsage } from './token-usage-service';
export declare const LanguageModelRegistryClient: unique symbol;
export interface LanguageModelRegistryClient {
    languageModelAdded(metadata: LanguageModelMetaData): void;
    languageModelRemoved(id: string): void;
    /**
     * Notify the client that a language model was updated.
     */
    onLanguageModelUpdated(id: string): void;
}
export declare const TOKEN_USAGE_SERVICE_PATH = "/services/token-usage";
export declare const TokenUsageServiceClient: unique symbol;
export interface TokenUsageServiceClient {
    /**
     * Notify the client about new token usage
     */
    notifyTokenUsage(usage: TokenUsage): void;
    /**
     * An event that is fired when token usage data is updated.
     */
    readonly onTokenUsageUpdated: Event<TokenUsage>;
}
//# sourceMappingURL=protocol.d.ts.map