import { Disposable, MessageService } from '@theia/core';
import { FrontendApplicationContribution, OpenerService } from '@theia/core/lib/browser';
import { AIVariable, AIVariableArg, AIVariableContext, AIVariableOpener, AIVariableResolutionRequest, AIVariableResourceResolver, AIVariableService, DefaultAIVariableService } from '../common';
import * as monaco from '@theia/monaco-editor-core';
export type AIVariableDropHandler = (event: DragEvent, context: AIVariableContext) => Promise<AIVariableDropResult | undefined>;
export interface AIVariableDropResult {
    variables: AIVariableResolutionRequest[];
    text?: string;
}
export type AIVariablePasteHandler = (event: ClipboardEvent, context: AIVariableContext) => Promise<AIVariablePasteResult | undefined>;
export interface AIVariablePasteResult {
    variables: AIVariableResolutionRequest[];
    text?: string;
}
export interface AIVariableCompletionContext {
    /** Portion of user input to be used for filtering completion candidates. */
    userInput: string;
    /** The range of suggestion completions. */
    range: monaco.Range;
    /** A prefix to be applied to each completion item's text */
    prefix: string;
}
export declare namespace AIVariableCompletionContext {
    function get(variableName: string, model: monaco.editor.ITextModel, position: monaco.Position, matchString?: string): AIVariableCompletionContext | undefined;
}
export declare const FrontendVariableService: unique symbol;
export interface FrontendVariableService extends AIVariableService {
    registerDropHandler(handler: AIVariableDropHandler): Disposable;
    unregisterDropHandler(handler: AIVariableDropHandler): void;
    getDropResult(event: DragEvent, context: AIVariableContext): Promise<AIVariableDropResult>;
    registerPasteHandler(handler: AIVariablePasteHandler): Disposable;
    unregisterPasteHandler(handler: AIVariablePasteHandler): void;
    getPasteResult(event: ClipboardEvent, context: AIVariableContext): Promise<AIVariablePasteResult>;
    registerOpener(variable: AIVariable, opener: AIVariableOpener): Disposable;
    unregisterOpener(variable: AIVariable, opener: AIVariableOpener): void;
    getOpener(name: string, arg: string | undefined, context: AIVariableContext): Promise<AIVariableOpener | undefined>;
    open(variable: AIVariableArg, context?: AIVariableContext): Promise<void>;
}
export interface FrontendVariableContribution {
    registerVariables(service: FrontendVariableService): void;
}
export declare class DefaultFrontendVariableService extends DefaultAIVariableService implements FrontendApplicationContribution, FrontendVariableService {
    protected dropHandlers: Set<AIVariableDropHandler>;
    protected pasteHandlers: Set<AIVariablePasteHandler>;
    protected readonly messageService: MessageService;
    protected readonly aiResourceResolver: AIVariableResourceResolver;
    protected readonly openerService: OpenerService;
    onStart(): void;
    registerDropHandler(handler: AIVariableDropHandler): Disposable;
    unregisterDropHandler(handler: AIVariableDropHandler): void;
    getDropResult(event: DragEvent, context: AIVariableContext): Promise<AIVariableDropResult>;
    registerPasteHandler(handler: AIVariablePasteHandler): Disposable;
    unregisterPasteHandler(handler: AIVariablePasteHandler): void;
    getPasteResult(event: ClipboardEvent, context: AIVariableContext): Promise<AIVariablePasteResult>;
    registerOpener(variable: AIVariable, opener: AIVariableOpener): Disposable;
    unregisterOpener(variable: AIVariable, opener: AIVariableOpener): void;
    getOpener(name: string, arg: string | undefined, context?: AIVariableContext): Promise<AIVariableOpener | undefined>;
    open(request: AIVariableArg, context?: AIVariableContext | undefined): Promise<void>;
    protected openReadonly(request: AIVariableResolutionRequest, context?: AIVariableContext): Promise<void>;
}
//# sourceMappingURL=frontend-variable-service.d.ts.map