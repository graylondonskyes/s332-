import { LanguageGrammarDefinitionContribution, TextmateRegistry } from '@theia/monaco/lib/browser/textmate';
import * as monaco from '@theia/monaco-editor-core';
import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { Widget } from '@theia/core/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser';
import { ToolInvocationRegistry } from '../common';
import { ProviderResult } from '@theia/monaco-editor-core/esm/vs/editor/common/languages';
import { AIVariableService } from '../common/variable-service';
export declare const PROMPT_TEMPLATE_EXTENSION = ".prompttemplate";
export declare const DISCARD_PROMPT_TEMPLATE_CUSTOMIZATIONS: Command;
export declare class PromptTemplateContribution implements LanguageGrammarDefinitionContribution, CommandContribution, TabBarToolbarContribution {
    private readonly promptService;
    protected readonly toolInvocationRegistry: ToolInvocationRegistry;
    protected readonly variableService: AIVariableService;
    readonly config: monaco.languages.LanguageConfiguration;
    registerTextmateLanguage(registry: TextmateRegistry): void;
    provideFunctionCompletions(model: monaco.editor.ITextModel, position: monaco.Position): ProviderResult<monaco.languages.CompletionList>;
    provideVariableCompletions(model: monaco.editor.ITextModel, position: monaco.Position): ProviderResult<monaco.languages.CompletionList>;
    provideVariableWithArgCompletions(model: monaco.editor.ITextModel, position: monaco.Position): Promise<monaco.languages.CompletionList>;
    getCompletionRange(model: monaco.editor.ITextModel, position: monaco.Position, triggerCharacters: string): monaco.Range | undefined;
    private getSuggestions;
    registerCommands(commands: CommandRegistry): void;
    protected isPromptTemplateWidget(widget: Widget | undefined): boolean;
    protected canDiscard(widget: Widget | undefined): boolean;
    protected discard(widget: EditorWidget): Promise<void>;
    registerToolbarItems(registry: TabBarToolbarRegistry): void;
}
//# sourceMappingURL=prompttemplate-contribution.d.ts.map