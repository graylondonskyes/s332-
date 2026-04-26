import { Widget, DockLayout } from '@theia/core/lib/browser';
import { SplitEditorContribution } from './split-editor-contribution';
import { EditorWidget } from './editor-widget';
import { EditorManager } from './editor-manager';
/**
 * Implementation of SplitEditorContribution for text editors (EditorWidget).
 */
export declare class TextEditorSplitContribution implements SplitEditorContribution<EditorWidget> {
    protected readonly editorManager: EditorManager;
    canHandle(widget: Widget): number;
    split(widget: EditorWidget, splitMode: DockLayout.InsertMode): Promise<EditorWidget | undefined>;
}
//# sourceMappingURL=text-editor-split-contribution.d.ts.map