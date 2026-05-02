import { DefaultLanguageModelRegistryImpl, LanguageModel, LanguageModelMetaData, LanguageModelRegistryClient } from '../common';
/**
 * Notifies a client whenever a model is added or removed
 */
export declare class BackendLanguageModelRegistryImpl extends DefaultLanguageModelRegistryImpl {
    private client;
    setClient(client: LanguageModelRegistryClient): void;
    addLanguageModels(models: LanguageModel[]): void;
    removeLanguageModels(ids: string[]): void;
    patchLanguageModel<T extends LanguageModel = LanguageModel>(id: string, patch: Partial<T>): Promise<void>;
    mapToMetaData(model: LanguageModel): LanguageModelMetaData;
}
//# sourceMappingURL=backend-language-model-registry.d.ts.map