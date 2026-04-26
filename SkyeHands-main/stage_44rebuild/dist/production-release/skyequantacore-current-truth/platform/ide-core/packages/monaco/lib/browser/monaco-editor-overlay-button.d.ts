import { Disposable } from '@theia/core';
import { MonacoEditor } from './monaco-editor';
export declare class MonacoEditorOverlayButton implements Disposable {
    private static nextId;
    readonly domNode: HTMLElement;
    protected readonly onClickEmitter: any;
    readonly onClick: any;
    protected readonly toDispose: any;
    constructor(editor: MonacoEditor, label: string, id?: string);
    get enabled(): boolean;
    set enabled(value: boolean);
    dispose(): void;
}
//# sourceMappingURL=monaco-editor-overlay-button.d.ts.map