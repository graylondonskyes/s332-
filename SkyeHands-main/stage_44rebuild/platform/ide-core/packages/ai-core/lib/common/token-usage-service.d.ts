import { TokenUsageServiceClient } from './protocol';
export declare const TokenUsageService: unique symbol;
export interface TokenUsage {
    /** The input token count */
    inputTokens: number;
    /** The output token count */
    outputTokens: number;
    /** Input tokens written to cache */
    cachedInputTokens?: number;
    /** Input tokens read from cache */
    readCachedInputTokens?: number;
    /** The model identifier */
    model: string;
    /** The timestamp of when the tokens were used */
    timestamp: Date;
    /** Request identifier */
    requestId: string;
}
export interface TokenUsageParams {
    /** The input token count */
    inputTokens: number;
    /** The output token count */
    outputTokens: number;
    /** Input tokens placed in cache */
    cachedInputTokens?: number;
    /** Input tokens read from cache */
    readCachedInputTokens?: number;
    /** Request identifier */
    requestId: string;
}
export interface TokenUsageService {
    /**
     * Records token usage for a model interaction.
     *
     * @param model The identifier of the model that was used
     * @param params Object containing token usage information
     * @returns A promise that resolves when the token usage has been recorded
     */
    recordTokenUsage(model: string, params: TokenUsageParams): Promise<void>;
    getTokenUsages(): Promise<TokenUsage[]>;
    setClient(tokenUsageClient: TokenUsageServiceClient): void;
}
//# sourceMappingURL=token-usage-service.d.ts.map