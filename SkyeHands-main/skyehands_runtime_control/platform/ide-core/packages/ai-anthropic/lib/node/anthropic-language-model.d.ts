import { LanguageModel, LanguageModelRequest, LanguageModelResponse, LanguageModelStatus, LanguageModelStreamResponse, LanguageModelTextResponse, TokenUsageService, UserRequest } from '@theia/ai-core';
import { CancellationToken } from '@theia/core';
import { Anthropic } from '@anthropic-ai/sdk';
export declare const DEFAULT_MAX_TOKENS = 4096;
/**
 * If possible adds a cache control to the last message in the conversation.
 * This is used to enable incremental caching of the conversation.
 * @param messages The messages to process
 * @returns A new messages array with the last message adapted to include cache control. If no cache control can be added, the original messages are returned.
 * In any case, the original messages are not modified
 */
export declare function addCacheControlToLastMessage(messages: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[];
export declare const AnthropicModelIdentifier: unique symbol;
/**
 * Implements the Anthropic language model integration for Theia
 */
export declare class AnthropicModel implements LanguageModel {
    readonly id: string;
    model: string;
    status: LanguageModelStatus;
    enableStreaming: boolean;
    useCaching: boolean;
    apiKey: () => string | undefined;
    url: string | undefined;
    maxTokens: number;
    maxRetries: number;
    protected readonly tokenUsageService?: TokenUsageService;
    proxy?: string | undefined;
    constructor(id: string, model: string, status: LanguageModelStatus, enableStreaming: boolean, useCaching: boolean, apiKey: () => string | undefined, url: string | undefined, maxTokens?: number, maxRetries?: number, tokenUsageService?: TokenUsageService, proxy?: string | undefined);
    protected getSettings(request: LanguageModelRequest): Readonly<Record<string, unknown>>;
    protected get defaultThinkingBudget(): number;
    request(request: UserRequest, cancellationToken?: CancellationToken): Promise<LanguageModelResponse>;
    protected handleStreamingRequest(anthropic: Anthropic, request: UserRequest, cancellationToken?: CancellationToken, toolMessages?: readonly Anthropic.Messages.MessageParam[]): Promise<LanguageModelStreamResponse>;
    protected createTools(request: LanguageModelRequest): Anthropic.Messages.Tool[] | undefined;
    protected handleNonStreamingRequest(anthropic: Anthropic, request: UserRequest): Promise<LanguageModelTextResponse>;
    protected initializeAnthropic(): Anthropic;
}
//# sourceMappingURL=anthropic-language-model.d.ts.map