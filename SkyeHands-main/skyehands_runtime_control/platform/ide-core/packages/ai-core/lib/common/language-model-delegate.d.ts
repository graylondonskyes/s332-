import { CancellationToken } from '@theia/core';
import { LanguageModelMetaData, LanguageModelParsedResponse, LanguageModelRequest, LanguageModelStreamResponsePart, LanguageModelTextResponse, ToolCallResult } from './language-model';
export declare const LanguageModelDelegateClient: unique symbol;
export interface LanguageModelDelegateClient {
    toolCall(requestId: string, toolId: string, args_string: string, toolCallId?: string): Promise<ToolCallResult>;
    send(id: string, token: LanguageModelStreamResponsePart | undefined): void;
    error(id: string, error: Error): void;
}
export declare const LanguageModelRegistryFrontendDelegate: unique symbol;
export interface LanguageModelRegistryFrontendDelegate {
    getLanguageModelDescriptions(): Promise<LanguageModelMetaData[]>;
}
export interface LanguageModelStreamResponseDelegate {
    streamId: string;
}
export declare const isLanguageModelStreamResponseDelegate: (obj: unknown) => obj is LanguageModelStreamResponseDelegate;
export type LanguageModelResponseDelegate = LanguageModelTextResponse | LanguageModelParsedResponse | LanguageModelStreamResponseDelegate;
export declare const LanguageModelFrontendDelegate: unique symbol;
export interface LanguageModelFrontendDelegate {
    cancel(requestId: string): void;
    request(modelId: string, request: LanguageModelRequest, requestId: string, cancellationToken?: CancellationToken): Promise<LanguageModelResponseDelegate>;
}
export declare const languageModelRegistryDelegatePath = "/services/languageModelRegistryDelegatePath";
export declare const languageModelDelegatePath = "/services/languageModelDelegatePath";
//# sourceMappingURL=language-model-delegate.d.ts.map