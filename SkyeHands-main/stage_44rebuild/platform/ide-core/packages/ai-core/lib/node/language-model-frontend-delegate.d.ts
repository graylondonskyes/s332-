import { CancellationToken } from '@theia/core';
import { LanguageModelMetaData, LanguageModelStreamResponsePart, LanguageModelDelegateClient, LanguageModelFrontendDelegate, LanguageModelRegistryFrontendDelegate, LanguageModelResponseDelegate, LanguageModelRegistryClient, UserRequest } from '../common';
export declare class LanguageModelRegistryFrontendDelegateImpl implements LanguageModelRegistryFrontendDelegate {
    private registry;
    setClient(client: LanguageModelRegistryClient): void;
    getLanguageModelDescriptions(): Promise<LanguageModelMetaData[]>;
}
export declare class LanguageModelFrontendDelegateImpl implements LanguageModelFrontendDelegate {
    private registry;
    private logger;
    private frontendDelegateClient;
    private requestCancellationTokenMap;
    setClient(client: LanguageModelDelegateClient): void;
    cancel(requestId: string): void;
    request(modelId: string, request: UserRequest, requestId: string, cancellationToken?: CancellationToken): Promise<LanguageModelResponseDelegate>;
    protected sendTokens(id: string, stream: AsyncIterable<LanguageModelStreamResponsePart>, cancellationToken?: CancellationToken): void;
}
//# sourceMappingURL=language-model-frontend-delegate.d.ts.map