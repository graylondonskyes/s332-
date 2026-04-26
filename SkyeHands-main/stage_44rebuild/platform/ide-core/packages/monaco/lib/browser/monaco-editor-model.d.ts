import { Position, Range, TextDocumentSaveReason } from '@theia/core/shared/vscode-languageserver-protocol';
import { TextEditorDocument, EncodingMode, FindMatchesOptions, FindMatch } from '@theia/editor/lib/browser';
import { Event } from '@theia/core/lib/common/event';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { Resource, ResourceVersion } from '@theia/core/lib/common/resource';
import { Saveable, SaveOptions } from '@theia/core/lib/browser/saveable';
import { MonacoToProtocolConverter } from './monaco-to-protocol-converter';
import { ProtocolToMonacoConverter } from './protocol-to-monaco-converter';
import { ILogger, Loggable } from '@theia/core/lib/common/logger';
import { ITextBufferFactory, ITextModel, ITextSnapshot } from '@theia/monaco-editor-core/esm/vs/editor/common/model';
import { IResolvedTextEditorModel } from '@theia/monaco-editor-core/esm/vs/editor/common/services/resolverService';
import * as monaco from '@theia/monaco-editor-core';
import { MarkdownString } from '@theia/core/lib/common/markdown-rendering';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { ListenerList } from '@theia/core';
import { EditorPreferences } from '@theia/editor/lib/common/editor-preferences';
export { TextDocumentSaveReason };
export interface WillSaveMonacoModelEvent {
    model: MonacoEditorModel;
    token: CancellationToken;
    options?: SaveOptions;
}
export interface MonacoModelContentChangedEvent {
    readonly model: MonacoEditorModel;
    readonly contentChanges: MonacoTextDocumentContentChange[];
}
export interface MonacoTextDocumentContentChange {
    readonly range: Range;
    readonly rangeOffset: number;
    readonly rangeLength: number;
    readonly text: string;
}
export declare class MonacoEditorModel implements IResolvedTextEditorModel, TextEditorDocument {
    protected readonly resource: Resource;
    protected readonly m2p: MonacoToProtocolConverter;
    protected readonly p2m: ProtocolToMonacoConverter;
    protected readonly logger?: ILogger;
    protected readonly editorPreferences?: EditorPreferences;
    suppressOpenEditorWhenDirty: boolean;
    lineNumbersMinChars: number;
    readonly onWillSaveLoopTimeOut = 1500;
    protected bufferSavedVersionId: number;
    protected model: ITextModel;
    protected readonly resolveModel: Promise<void>;
    protected readonly toDispose: any;
    protected readonly toDisposeOnAutoSave: any;
    protected readonly onDidChangeContentEmitter: any;
    readonly onDidChangeContent: any;
    get onContentChanged(): Event<void>;
    protected readonly onDidSaveModelEmitter: any;
    readonly onDidSaveModel: any;
    protected readonly onDidChangeValidEmitter: any;
    readonly onDidChangeValid: any;
    protected readonly onDidChangeEncodingEmitter: any;
    readonly onDidChangeEncoding: any;
    readonly onDidChangeReadOnly: Event<boolean | MarkdownString>;
    private preferredEncoding;
    private contentEncoding;
    protected resourceVersion: ResourceVersion | undefined;
    protected readonly onWillSaveModelListeners: ListenerList<WillSaveMonacoModelEvent, Promise<void>>;
    readonly onModelWillSaveModel: any;
    constructor(resource: Resource, m2p: MonacoToProtocolConverter, p2m: ProtocolToMonacoConverter, logger?: ILogger, editorPreferences?: EditorPreferences);
    undo(): void;
    redo(): void;
    dispose(): void;
    isDisposed(): boolean;
    resolve(): Promise<void>;
    isResolved(): boolean;
    setEncoding(encoding: string, mode: EncodingMode): Promise<void>;
    getEncoding(): string | undefined;
    protected setPreferredEncoding(encoding: string): boolean;
    protected updateContentEncoding(): void;
    /**
     * #### Important
     * Only this method can create an instance of `monaco.editor.IModel`,
     * there should not be other calls to `monaco.editor.createModel`.
     */
    protected initialize(value: string | ITextBufferFactory): void;
    /**
     * Use `valid` to access it.
     * Use `setValid` to mutate it.
     */
    protected _valid: boolean;
    /**
     * Whether it is possible to load content from the underlying resource.
     */
    get valid(): boolean;
    protected setValid(valid: boolean): void;
    protected _dirty: boolean;
    get dirty(): boolean;
    protected setDirty(dirty: boolean): void;
    private updateSavedVersionId;
    protected readonly onDirtyChangedEmitter: any;
    get onDirtyChanged(): Event<void>;
    get uri(): string;
    get autosaveable(): boolean | undefined;
    protected _languageId: string | undefined;
    get languageId(): string;
    getLanguageId(): string | undefined;
    /**
     * It's a hack to dispatch close notification with an old language id; don't use it.
     */
    setLanguageId(languageId: string | undefined): void;
    get version(): number;
    /**
     * Return selected text by Range or all text by default
     */
    getText(range?: Range): string;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    get lineCount(): number;
    /**
     * Retrieves a line in a text document expressed as a one-based position.
     */
    getLineContent(lineNumber: number): string;
    getLineMaxColumn(lineNumber: number): number;
    toValidPosition(position: Position): Position;
    toValidRange(range: Range): Range;
    get readOnly(): boolean | MarkdownString;
    isReadonly(): boolean | MarkdownString;
    get onDispose(): monaco.IEvent<void>;
    get onWillDispose(): Event<void>;
    get textEditorModel(): monaco.editor.ITextModel & ITextModel;
    /**
     * Find all matches in an editor for the given options.
     * @param options the options for finding matches.
     *
     * @returns the list of matches.
     */
    findMatches(options: FindMatchesOptions): FindMatch[];
    load(): Promise<MonacoEditorModel>;
    save(options?: SaveOptions): Promise<void>;
    protected pendingOperation: Promise<void>;
    protected run(operation: () => Promise<void>): Promise<void>;
    protected syncCancellationTokenSource: any;
    protected cancelSync(): CancellationToken;
    sync(): Promise<void>;
    protected doSync(token: CancellationToken): Promise<void>;
    protected readContents(): Promise<string | ITextBufferFactory | undefined>;
    protected ignoreDirtyEdits: boolean;
    protected markAsDirty(): void;
    protected saveCancellationTokenSource: any;
    protected cancelSave(): CancellationToken;
    protected scheduleSave(token?: CancellationToken, overwriteEncoding?: boolean, options?: SaveOptions): Promise<void>;
    protected ignoreContentChanges: boolean;
    protected readonly contentChanges: MonacoTextDocumentContentChange[];
    protected pushContentChanges(contentChanges: MonacoTextDocumentContentChange[]): void;
    protected fireDidChangeContent(event: monaco.editor.IModelContentChangedEvent): void;
    protected asContentChangedEvent(event: monaco.editor.IModelContentChangedEvent): MonacoModelContentChangedEvent;
    protected asTextDocumentContentChangeEvent(change: monaco.editor.IModelContentChange): MonacoTextDocumentContentChange;
    protected applyEdits(operations: monaco.editor.IIdentifiedSingleEditOperation[], options?: Partial<MonacoEditorModel.ApplyEditsOptions>): void;
    protected updateModel<T>(doUpdate: () => T, options?: Partial<MonacoEditorModel.ApplyEditsOptions>): T;
    protected doSave(token: CancellationToken, overwriteEncoding?: boolean, options?: SaveOptions): Promise<void>;
    protected fireWillSaveModel(token: CancellationToken, options?: SaveOptions): Promise<void>;
    protected fireDidSaveModel(): void;
    revert(options?: Saveable.RevertOptions): Promise<void>;
    createSnapshot(preserveBOM?: boolean): ITextSnapshot;
    applySnapshot(snapshot: Saveable.Snapshot): void;
    serialize(): Promise<BinaryBuffer>;
    filters(): {
        [name: string]: string[];
    };
    protected trace(loggable: Loggable): void;
}
export declare namespace MonacoEditorModel {
    interface ApplyEditsOptions {
        ignoreDirty: boolean;
        ignoreContentChanges: boolean;
    }
}
//# sourceMappingURL=monaco-editor-model.d.ts.map