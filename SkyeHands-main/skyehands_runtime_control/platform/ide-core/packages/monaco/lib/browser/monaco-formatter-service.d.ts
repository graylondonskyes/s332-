import { Event, PreferenceInspection, PreferenceLanguageOverrideService, PreferenceScope, PreferenceService } from '@theia/core';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FormatterInfo, FormatterService, FormatterSettingScope, FormatterStatus } from '@theia/editor/lib/browser/editor-formatter-service';
import { TextEditor } from '@theia/editor/lib/browser';
import { DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider } from '@theia/monaco-editor-core/esm/vs/editor/common/languages';
import { ExtensionIdentifier } from '@theia/monaco-editor-core/esm/vs/platform/extensions/common/extensions';
import { ITextModel } from '@theia/monaco-editor-core/esm/vs/editor/common/model';
/**
 * Extended formatter provider interface that includes extension metadata.
 * These properties are added by Theia when registering formatters from plugins.
 */
export interface FormattingEditProviderWithMetadata {
    extensionId?: ExtensionIdentifier;
    displayName?: string;
}
export type DocumentFormattingEditProviderWithMetadata = DocumentFormattingEditProvider & FormattingEditProviderWithMetadata;
export type DocumentRangeFormattingEditProviderWithMetadata = DocumentRangeFormattingEditProvider & FormattingEditProviderWithMetadata;
export declare class MonacoFormatterService implements FormatterService {
    protected readonly preferenceService: PreferenceService;
    protected readonly preferenceSchema: PreferenceLanguageOverrideService;
    protected readonly workspaceService: WorkspaceService;
    protected readonly onDidChangeFormattersEmitter: any;
    readonly onDidChangeFormatters: Event<void>;
    protected init(): void;
    protected getFormatterPreferenceName(languageId: string): string;
    getFormatterStatus(editor: TextEditor): FormatterStatus;
    protected getConfiguredFormatterStatus(preferenceName: string, resourceUri: string, formatters: FormatterInfo[]): FormatterStatus | undefined;
    /**
     * Determines the preference scope from an inspection result.
     * In single-folder workspaces, folder and workspace scopes are equivalent,
     * so we need to check if we're in a multi-root workspace.
     */
    protected getConfiguredScopeFromInspection<T>(inspection: PreferenceInspection<T>): PreferenceScope | undefined;
    protected preferenceToFormatterScope(scope: PreferenceScope | undefined): FormatterSettingScope;
    getAvailableFormatters(editor: TextEditor): FormatterInfo[];
    protected getEditorModel(editor: TextEditor): ITextModel | undefined;
    protected extractUniqueFormatters(formatters: Array<DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider>): FormatterInfo[];
    setDefaultFormatter(languageIdOrEditor: string | TextEditor, formatterId: string | undefined, scope: PreferenceScope): Promise<void>;
    getDefaultFormatter(languageId: string, resourceUri: string): string | undefined;
    getConfiguredScope(editor: TextEditor): PreferenceScope | undefined;
}
//# sourceMappingURL=monaco-formatter-service.d.ts.map