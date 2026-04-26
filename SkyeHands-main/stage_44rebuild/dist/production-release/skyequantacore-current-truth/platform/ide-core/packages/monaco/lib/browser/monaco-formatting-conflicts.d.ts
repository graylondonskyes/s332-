import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { MonacoQuickInputService } from './monaco-quick-input-service';
import { MonacoFormatterService } from './monaco-formatter-service';
export declare class MonacoFormattingConflictsContribution implements FrontendApplicationContribution {
    protected readonly monacoQuickInputService: MonacoQuickInputService;
    protected readonly editorManager: EditorManager;
    protected readonly formatterService: MonacoFormatterService;
    initialize(): Promise<void>;
    private selectFormatter;
}
//# sourceMappingURL=monaco-formatting-conflicts.d.ts.map