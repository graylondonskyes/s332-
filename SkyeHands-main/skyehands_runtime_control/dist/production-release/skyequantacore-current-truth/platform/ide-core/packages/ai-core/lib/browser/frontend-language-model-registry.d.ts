import { OutputChannelManager } from '@theia/output/lib/browser/output-channel';
import { AISettingsService, DefaultLanguageModelRegistryImpl, FrontendLanguageModelRegistry, LanguageModel, LanguageModelAliasRegistry, LanguageModelDelegateClient, LanguageModelFrontendDelegate, LanguageModelMetaData, LanguageModelRegistryClient, LanguageModelRegistryFrontendDelegate, LanguageModelRequest, LanguageModelSelector, LanguageModelStreamResponsePart, ToolCallResult } from '../common';
export declare class LanguageModelDelegateClientImpl implements LanguageModelDelegateClient, LanguageModelRegistryClient {
    onLanguageModelUpdated(id: string): void;
    protected receiver: FrontendLanguageModelRegistryImpl;
    setReceiver(receiver: FrontendLanguageModelRegistryImpl): void;
    send(id: string, token: LanguageModelStreamResponsePart | undefined): void;
    toolCall(requestId: string, toolId: string, args_string: string, toolCallId?: string): Promise<ToolCallResult>;
    error(id: string, error: Error): void;
    languageModelAdded(metadata: LanguageModelMetaData): void;
    languageModelRemoved(id: string): void;
}
interface StreamState {
    id: string;
    tokens: (LanguageModelStreamResponsePart | undefined)[];
    resolve?: (_: unknown) => void;
    reject?: (_: unknown) => void;
}
export declare class FrontendLanguageModelRegistryImpl extends DefaultLanguageModelRegistryImpl implements FrontendLanguageModelRegistry {
    protected aliasRegistry: LanguageModelAliasRegistry;
    languageModelAdded(metadata: LanguageModelMetaData): void;
    languageModelRemoved(id: string): void;
    onLanguageModelUpdated(id: string): void;
    /**
     * Fetch the updated model metadata from the backend and update the registry.
     */
    protected updateLanguageModelFromBackend(id: string): Promise<void>;
    protected registryDelegate: LanguageModelRegistryFrontendDelegate;
    protected providerDelegate: LanguageModelFrontendDelegate;
    protected client: LanguageModelDelegateClientImpl;
    protected outputChannelManager: OutputChannelManager;
    protected settingsService: AISettingsService;
    private static requestCounter;
    addLanguageModels(models: LanguageModelMetaData[] | LanguageModel[]): void;
    protected init(): void;
    createFrontendLanguageModel(description: LanguageModelMetaData): LanguageModel;
    protected streams: Map<string, StreamState>;
    protected requests: Map<string, LanguageModelRequest>;
    getIterable(state: StreamState): AsyncIterable<LanguageModelStreamResponsePart>;
    send(id: string, token: LanguageModelStreamResponsePart | undefined): void;
    toolCall(id: string, toolId: string, arg_string: string, toolCallId?: string): Promise<ToolCallResult>;
    error(id: string, error: Error): void;
    selectLanguageModels(request: LanguageModelSelector): Promise<LanguageModel[] | undefined>;
    getReadyLanguageModel(idOrAlias: string): Promise<LanguageModel | undefined>;
}
export {};
//# sourceMappingURL=frontend-language-model-registry.d.ts.map