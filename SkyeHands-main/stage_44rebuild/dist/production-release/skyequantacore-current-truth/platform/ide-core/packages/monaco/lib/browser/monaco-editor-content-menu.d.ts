import { CommandMenu, CommandRegistry, Disposable, MenuModelRegistry } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Context } from '@theia/core/lib/browser/context-key-service';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { MonacoContextKeyService } from './monaco-context-key-service';
import { MonacoEditor } from './monaco-editor';
/**
 * Implements {@link EDITOR_CONTENT_MENU} for {@link MonacoEditor}s.
 */
export declare class MonacoEditorContentMenuContribution implements FrontendApplicationContribution {
    protected readonly editorManager: EditorManager;
    protected readonly menus: MenuModelRegistry;
    protected readonly commands: CommandRegistry;
    protected readonly contextKeyService: MonacoContextKeyService;
    onStart(): void;
    protected createEditorContentMenu(editor: MonacoEditor, editorWidget: EditorWidget): Disposable;
    protected getEditorContentMenuNodes(): CommandMenu[];
    protected withContext<T>(context: Context, callback: () => T): T;
}
//# sourceMappingURL=monaco-editor-content-menu.d.ts.map