import { CommandService, ILogger } from '@theia/core';
import * as monaco from '@theia/monaco-editor-core';
import { AIVariable, AIVariableContribution, AIVariableService, AIVariableResolutionRequest, AIVariableContext, ResolvedAIVariable, AIVariableResolverWithVariableDependencies, AIVariableArg } from '../common/variable-service';
import { PromptService } from '../common/prompt-service';
export declare const PROMPT_VARIABLE: AIVariable;
export declare class PromptVariableContribution implements AIVariableContribution, AIVariableResolverWithVariableDependencies {
    protected readonly commandService: CommandService;
    protected readonly promptService: PromptService;
    protected logger: ILogger;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, context: AIVariableContext): number;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable | undefined>;
    private substituteCommandArguments;
    private parseCommandArguments;
    protected triggerArgumentPicker(): Promise<string | undefined>;
    protected provideArgumentCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position): Promise<monaco.languages.CompletionItem[] | undefined>;
    /**
     * Resolves multiple prompt fragments in parallel and concatenates their resolved text.
     */
    resolvePromptFragments(fragmentIds: string[], variable: AIVariable, context: AIVariableContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable>;
}
//# sourceMappingURL=prompt-variable-contribution.d.ts.map