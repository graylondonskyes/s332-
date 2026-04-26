import URI from '@theia/core/lib/common/uri';
import { Disposable } from '@theia/core/lib/common';
import { Dimension, DiffNavigator, DeltaDecorationParams } from '@theia/editor/lib/browser';
import { MonacoEditorModel } from './monaco-editor-model';
import { EditorServiceOverrides, MonacoEditor, MonacoEditorServices } from './monaco-editor';
import { MonacoDiffNavigatorFactory } from './monaco-diff-navigator-factory';
import * as monaco from '@theia/monaco-editor-core';
import { IDiffEditorConstructionOptions } from '@theia/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IStandaloneDiffEditor } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';
import { IEditorOptions } from '@theia/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { ILineChange } from '@theia/monaco-editor-core/esm/vs/editor/common/diff/legacyLinesDiffComputer';
export declare namespace MonacoDiffEditor {
    interface IOptions extends MonacoEditor.ICommonOptions, IDiffEditorConstructionOptions {
    }
}
export declare class MonacoDiffEditor extends MonacoEditor {
    readonly originalModel: MonacoEditorModel;
    readonly modifiedModel: MonacoEditorModel;
    protected readonly diffNavigatorFactory: MonacoDiffNavigatorFactory;
    protected _diffEditor: IStandaloneDiffEditor;
    protected _diffNavigator: DiffNavigator;
    protected readonly diffEditorModel: monaco.editor.IDiffEditorModel;
    constructor(uri: URI, node: HTMLElement, originalModel: MonacoEditorModel, modifiedModel: MonacoEditorModel, services: MonacoEditorServices, diffNavigatorFactory: MonacoDiffNavigatorFactory, options?: MonacoDiffEditor.IOptions, override?: EditorServiceOverrides, parentEditor?: MonacoEditor);
    get diffEditor(): monaco.editor.IStandaloneDiffEditor;
    get diffNavigator(): DiffNavigator;
    get diffInformation(): ILineChange[];
    protected create(options?: IDiffEditorConstructionOptions, override?: EditorServiceOverrides): Disposable;
    protected wordWrapOverride: IEditorOptions['wordWrapOverride2'];
    protected lastReachedSideBySideBreakpoint: boolean;
    protected resize(dimension: Dimension | null): void;
    isActionSupported(id: string): boolean;
    deltaDecorations(params: DeltaDecorationParams): string[];
    getResourceUri(): URI;
    createMoveToUri(resourceUri: URI): URI;
    handleVisibilityChanged(nowVisible: boolean): void;
    readonly onShouldDisplayDirtyDiffChanged: undefined;
    shouldDisplayDirtyDiff(): boolean;
    setShouldDisplayDirtyDiff(value: boolean): void;
    protected get baseEditor(): monaco.editor.IEditor;
    protected get baseModel(): monaco.editor.IEditorModel;
}
//# sourceMappingURL=monaco-diff-editor.d.ts.map