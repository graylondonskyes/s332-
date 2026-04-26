import URI from '@theia/core/lib/common/uri';
import { ResourceProvider, Event, MaybePromise, Resource, ContributionProvider } from '@theia/core';
import { EditorPreferences, EditorPreferenceChange } from '@theia/editor/lib/common/editor-preferences';
import { MonacoEditorModel } from './monaco-editor-model';
import { IDisposable, IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { MonacoToProtocolConverter } from './monaco-to-protocol-converter';
import { ProtocolToMonacoConverter } from './protocol-to-monaco-converter';
import { ILogger } from '@theia/core/lib/common/logger';
import * as monaco from '@theia/monaco-editor-core';
import { ITextModelService, ITextModelContentProvider } from '@theia/monaco-editor-core/esm/vs/editor/common/services/resolverService';
import { ITextModelUpdateOptions } from '@theia/monaco-editor-core/esm/vs/editor/common/model';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
export declare const MonacoEditorModelFactory: unique symbol;
export interface MonacoEditorModelFactory {
    readonly scheme: string;
    createModel(resource: Resource): MaybePromise<MonacoEditorModel>;
}
export declare const MonacoEditorModelFilter: unique symbol;
/**
 * A filter that prevents firing the `onDidCreate` event for certain models.
 * Preventing this event from firing will also prevent the propagation of the model to the plugin host.
 *
 * This is useful for models that are not supposed to be opened in a dedicated monaco editor widgets.
 * This includes models for notebook cells.
 */
export interface MonacoEditorModelFilter {
    /**
     * Return `true` on models that should be filtered.
     */
    filter(model: MonacoEditorModel): boolean;
}
export declare class MonacoTextModelService implements ITextModelService {
    readonly _serviceBrand: undefined;
    protected readonly _models: any;
    protected readonly _visibleModels: Set<MonacoEditorModel>;
    protected readonly onDidCreateEmitter: any;
    protected readonly resourceProvider: ResourceProvider;
    protected readonly editorPreferences: EditorPreferences;
    protected readonly m2p: MonacoToProtocolConverter;
    protected readonly p2m: ProtocolToMonacoConverter;
    protected readonly factories: ContributionProvider<MonacoEditorModelFactory>;
    protected readonly filters: ContributionProvider<MonacoEditorModelFilter>;
    protected readonly logger: ILogger;
    protected readonly fileService: FileService;
    protected init(): void;
    get models(): MonacoEditorModel[];
    get(uri: string): MonacoEditorModel | undefined;
    get onDidCreate(): Event<MonacoEditorModel>;
    createModelReference(raw: monaco.Uri | URI): Promise<IReference<MonacoEditorModel>>;
    loadModel(uri: URI): Promise<MonacoEditorModel>;
    protected createModel(resource: Resource): MaybePromise<MonacoEditorModel>;
    protected readonly modelOptions: {
        [name: string]: (keyof ITextModelUpdateOptions | undefined);
    };
    protected toModelOption(editorPreference: EditorPreferenceChange['preferenceName']): keyof ITextModelUpdateOptions | undefined;
    registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): IDisposable;
    canHandleResource(resource: monaco.Uri): boolean;
}
//# sourceMappingURL=monaco-text-model-service.d.ts.map