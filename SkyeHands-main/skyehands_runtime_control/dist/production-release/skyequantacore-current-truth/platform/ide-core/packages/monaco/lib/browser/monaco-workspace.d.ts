import { URI as Uri } from '@theia/core/shared/vscode-uri';
import { FileSystemPreferences } from '@theia/filesystem/lib/common';
import { EditorManager } from '@theia/editor/lib/browser';
import { MonacoTextModelService } from './monaco-text-model-service';
import { MonacoEditorModel, MonacoModelContentChangedEvent } from './monaco-editor-model';
import { MonacoEditor } from './monaco-editor';
import { ProblemManager } from '@theia/markers/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import * as monaco from '@theia/monaco-editor-core';
import { IBulkEditOptions, IBulkEditResult, ResourceEdit, ResourceFileEdit as MonacoResourceFileEdit, ResourceTextEdit as MonacoResourceTextEdit } from '@theia/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import { TextEdit } from '@theia/monaco-editor-core/esm/vs/editor/common/languages';
import { MaybePromise } from '@theia/core/lib/common';
import { SaveableService } from '@theia/core/lib/browser';
import { EditorPreferences } from '@theia/editor/lib/common/editor-preferences';
export declare namespace WorkspaceFileEdit {
    function is(arg: Edit): arg is monaco.languages.IWorkspaceFileEdit;
}
export declare namespace WorkspaceTextEdit {
    function is(arg: Edit): arg is monaco.languages.IWorkspaceTextEdit;
}
export type Edit = monaco.languages.IWorkspaceFileEdit | monaco.languages.IWorkspaceTextEdit;
export declare namespace ResourceFileEdit {
    function is(arg: ResourceEdit): arg is MonacoResourceFileEdit;
}
export declare namespace ResourceTextEdit {
    function is(arg: ResourceEdit): arg is MonacoResourceTextEdit;
}
export interface WorkspaceFoldersChangeEvent {
    readonly added: WorkspaceFolder[];
    readonly removed: WorkspaceFolder[];
}
export interface WorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
    readonly index: number;
}
export declare class MonacoWorkspace {
    protected resolveReady: () => void;
    readonly ready: Promise<void>;
    protected readonly onDidOpenTextDocumentEmitter: any;
    readonly onDidOpenTextDocument: any;
    protected readonly onDidCloseTextDocumentEmitter: any;
    readonly onDidCloseTextDocument: any;
    protected readonly onDidChangeTextDocumentEmitter: any;
    readonly onDidChangeTextDocument: any;
    protected readonly onDidSaveTextDocumentEmitter: any;
    readonly onDidSaveTextDocument: any;
    protected readonly fileService: FileService;
    protected readonly filePreferences: FileSystemPreferences;
    protected readonly editorPreferences: EditorPreferences;
    protected readonly textModelService: MonacoTextModelService;
    protected readonly editorManager: EditorManager;
    protected readonly problems: ProblemManager;
    protected readonly saveService: SaveableService;
    protected init(): void;
    get textDocuments(): MonacoEditorModel[];
    getTextDocument(uri: string): MonacoEditorModel | undefined;
    protected fireDidOpen(model: MonacoEditorModel): void;
    protected doFireDidOpen(model: MonacoEditorModel): void;
    protected fireDidClose(model: MonacoEditorModel): void;
    protected fireDidChangeContent(event: MonacoModelContentChangedEvent): void;
    protected fireDidSave(model: MonacoEditorModel): void;
    protected readonly suppressedOpenIfDirty: MonacoEditorModel[];
    protected openEditorIfDirty(model: MonacoEditorModel): void;
    protected suppressOpenIfDirty(model: MonacoEditorModel, cb: () => MaybePromise<void>): Promise<void>;
    /**
     * Applies given edits to the given model.
     * The model is saved if no editors is opened for it.
     */
    applyBackgroundEdit(model: MonacoEditorModel, editOperations: monaco.editor.IIdentifiedSingleEditOperation[], shouldSave?: boolean | ((openEditor: MonacoEditor | undefined, wasDirty: boolean) => boolean)): Promise<void>;
    applyBulkEdit(edits: ResourceEdit[], options?: IBulkEditOptions): Promise<IBulkEditResult>;
    protected saveAll(resources: Set<string>): Promise<void>;
    protected getAriaSummary(totalEdits: number, totalFiles: number): string;
    protected performTextEdits(edits: MonacoResourceTextEdit[]): Promise<{
        totalEdits: number;
        totalFiles: number;
    }>;
    protected performFileEdits(edits: MonacoResourceFileEdit[]): Promise<void>;
    protected performSnippetEdits(edits: MonacoResourceTextEdit[]): Promise<void>;
    protected transformSnippetStringToInsertText(resourceEdit: MonacoResourceTextEdit): TextEdit & {
        insertAsSnippet?: boolean;
    };
}
//# sourceMappingURL=monaco-workspace.d.ts.map