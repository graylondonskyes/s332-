import { UndoRedoHandler } from '@theia/core/lib/browser';
import { ICodeEditor } from '@theia/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
export declare abstract class AbstractMonacoUndoRedoHandler implements UndoRedoHandler<ICodeEditor> {
    priority: number;
    abstract select(): ICodeEditor | undefined;
    undo(item: ICodeEditor): void;
    redo(item: ICodeEditor): void;
}
export declare class FocusedMonacoUndoRedoHandler extends AbstractMonacoUndoRedoHandler {
    priority: number;
    protected codeEditorService: any;
    select(): ICodeEditor | undefined;
}
export declare class ActiveMonacoUndoRedoHandler extends AbstractMonacoUndoRedoHandler {
    priority: number;
    protected codeEditorService: any;
    select(): ICodeEditor | undefined;
}
//# sourceMappingURL=monaco-undo-redo-handler.d.ts.map