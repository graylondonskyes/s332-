import { Event } from '@theia/core';
/**
 * Data structure for token usage data specific to a model.
 */
export interface ModelTokenUsageData {
    /** The model identifier */
    modelId: string;
    /** Number of input tokens used */
    inputTokens: number;
    /** Number of output tokens used */
    outputTokens: number;
    /** Number of input tokens written to cache */
    cachedInputTokens?: number;
    /** Number of input tokens read from cache */
    readCachedInputTokens?: number;
    /** Date when the model was last used */
    lastUsed?: Date;
}
/**
 * Service for managing token usage data on the frontend.
 */
export declare const TokenUsageFrontendService: unique symbol;
export interface TokenUsageFrontendService {
    /**
     * Event emitted when token usage data is updated
     */
    readonly onTokenUsageUpdated: Event<ModelTokenUsageData[]>;
    /**
     * Gets the current token usage data for all models
     */
    getTokenUsageData(): Promise<ModelTokenUsageData[]>;
}
//# sourceMappingURL=token-usage-frontend-service.d.ts.map