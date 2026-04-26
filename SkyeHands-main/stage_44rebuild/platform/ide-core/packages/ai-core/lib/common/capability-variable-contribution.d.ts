import { ILogger } from '@theia/core';
import * as monaco from '@theia/monaco-editor-core';
import { AIVariable, AIVariableContribution, AIVariableService, AIVariableResolutionRequest, ResolvedAIVariable, AIVariableResolverWithVariableDependencies, AIVariableArg, AIVariableContext } from './variable-service';
import { PromptService } from './prompt-service';
import { CapabilityAwareContext } from './capability-utils';
export declare const CAPABILITY_VARIABLE: AIVariable;
export declare class CapabilityVariableContribution implements AIVariableContribution, AIVariableResolverWithVariableDependencies {
    protected readonly promptService: PromptService;
    protected logger: ILogger;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, context: AIVariableContext): number;
    resolve(request: AIVariableResolutionRequest, context: CapabilityAwareContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable | undefined>;
    protected provideArgumentCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position): Promise<monaco.languages.CompletionItem[] | undefined>;
}
//# sourceMappingURL=capability-variable-contribution.d.ts.map