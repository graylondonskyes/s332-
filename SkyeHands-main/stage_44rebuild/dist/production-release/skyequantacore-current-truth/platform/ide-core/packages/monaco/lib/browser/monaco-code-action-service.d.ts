import { CancellationToken } from '@theia/core';
import { CodeActionSet } from '@theia/monaco-editor-core/esm/vs/editor/contrib/codeAction/common/types';
import { EditorPreferences } from '@theia/editor/lib/common/editor-preferences';
import { ITextModel } from '@theia/monaco-editor-core/esm/vs/editor/common/model';
export declare const MonacoCodeActionService: unique symbol;
export interface MonacoCodeActionService {
    /**
     * Gets all code actions that should be applied on save for the given model and language identifier.
     * @param model The text model to get code actions for
     * @param languageId The language identifier for preference lookup
     * @param uri The URI string for preference scoping
     * @param token Cancellation token
     * @returns Array of code action sets to apply, or undefined if no actions should be applied
     */
    getAllCodeActionsOnSave(model: ITextModel, languageId: string, uri: string, token: CancellationToken): Promise<CodeActionSet[] | undefined>;
    /**
     * Applies the provided code actions for the given model.
     * @param model The text model to apply code actions to
     * @param codeActionSets Array of code action sets to apply
     * @param token Cancellation token
     */
    applyCodeActions(model: ITextModel, codeActionSets: CodeActionSet[], token: CancellationToken): Promise<void>;
    /**
     * Applies all code actions that should be run on save for the given model and language identifier.
     * This is a convenience method that retrieves all on-save code actions and applies them.
     * @param model The text model to apply code actions to
     * @param languageId The language identifier for preference lookup
     * @param uri The URI string for preference scoping
     * @param token Cancellation token
     */
    applyOnSaveCodeActions(model: ITextModel, languageId: string, uri: string, token: CancellationToken): Promise<void>;
}
export declare class MonacoCodeActionServiceImpl implements MonacoCodeActionService {
    protected readonly editorPreferences: EditorPreferences;
    applyOnSaveCodeActions(model: ITextModel, languageId: string, uri: string, token: CancellationToken): Promise<void>;
    getAllCodeActionsOnSave(model: ITextModel, languageId: string, uri: string, token: CancellationToken): Promise<CodeActionSet[] | undefined>;
    applyCodeActions(model: ITextModel, codeActionSets: CodeActionSet[], token: CancellationToken): Promise<void>;
    private createCodeActionsOnSave;
    private getActionsToRun;
}
//# sourceMappingURL=monaco-code-action-service.d.ts.map