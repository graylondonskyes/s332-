import { CancellationToken } from '@theia/core';
import { SaveOptions } from '@theia/core/lib/browser';
import { MonacoEditor } from './monaco-editor';
import { SaveParticipant } from './monaco-editor-provider';
import { MonacoCodeActionService } from './monaco-code-action-service';
export declare class MonacoCodeActionSaveParticipant implements SaveParticipant {
    protected readonly codeActionService: MonacoCodeActionService;
    readonly order = 0;
    applyChangesOnSave(editor: MonacoEditor, cancellationToken: CancellationToken, options?: SaveOptions): Promise<void>;
}
//# sourceMappingURL=monaco-code-action-save-participant.d.ts.map