import { ContributionProvider, Disposable, ILogger, MaybePromise, Event } from '@theia/core';
import * as monaco from '@theia/monaco-editor-core';
/**
 * A variable is a short string that is used to reference a value that is resolved and replaced in the user prompt at request-time.
 */
export interface AIVariable {
    /** provider id */
    id: string;
    /** variable name, used for referencing variables in the chat */
    name: string;
    /** variable description */
    description: string;
    /** optional label, used for showing the variable in the UI. If not provided, the variable name is used */
    label?: string;
    /** optional icon classes, used for showing the variable in the UI. */
    iconClasses?: string[];
    /** specifies whether this variable contributes to the context -- @see ResolvedAIContextVariable */
    isContextVariable?: boolean;
    /** optional arguments for resolving the variable into a value */
    args?: AIVariableDescription[];
}
export declare namespace AIVariable {
    function is(arg: unknown): arg is AIVariable;
}
export interface AIContextVariable extends AIVariable {
    label: string;
    isContextVariable: true;
}
export declare namespace AIContextVariable {
    function is(arg: unknown): arg is AIContextVariable;
}
export interface AIVariableDescription {
    name: string;
    description: string;
    enum?: string[];
    isOptional?: boolean;
}
export interface ResolvedAIVariable {
    variable: AIVariable;
    arg?: string;
    /** value that is inserted into the prompt at the position of the variable usage */
    value: string;
    /** Flat list of all variables that have been (recursively) resolved while resolving this variable. */
    allResolvedDependencies?: ResolvedAIVariable[];
}
export declare namespace ResolvedAIVariable {
    function is(arg: unknown): arg is ResolvedAIVariable;
}
/**
 * A context variable is a variable that also contributes to the context of a chat request.
 *
 * In contrast to a plain variable, it can also be attached to a request and is resolved into a context value.
 * The context value is put into the `ChatRequestModel.context`, available to the processing chat agent for further
 * processing by the chat agent, or invoked tool functions.
 */
export interface ResolvedAIContextVariable extends ResolvedAIVariable {
    contextValue: string;
}
export declare namespace ResolvedAIContextVariable {
    function is(arg: unknown): arg is ResolvedAIContextVariable;
}
export interface AIVariableResolutionRequest {
    variable: AIVariable;
    arg?: string;
}
export declare namespace AIVariableResolutionRequest {
    function is(arg: unknown): arg is AIVariableResolutionRequest;
    function fromResolved(arg: ResolvedAIContextVariable): AIVariableResolutionRequest;
}
export interface AIVariableContext {
}
export type AIVariableArg = string | {
    variable: string;
    arg?: string;
} | AIVariableResolutionRequest;
export type AIVariableArgPicker = (context: AIVariableContext) => MaybePromise<string | undefined>;
export type AIVariableArgCompletionProvider = (model: monaco.editor.ITextModel, position: monaco.Position, matchString?: string) => MaybePromise<monaco.languages.CompletionItem[] | undefined>;
export interface AIVariableResolver {
    canResolve(request: AIVariableResolutionRequest, context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<ResolvedAIVariable | undefined>;
}
export interface AIVariableOpener {
    canOpen(request: AIVariableResolutionRequest, context: AIVariableContext): MaybePromise<number>;
    open(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<void>;
}
export interface AIVariableResolverWithVariableDependencies extends AIVariableResolver {
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<ResolvedAIVariable | undefined>;
    /**
     * Resolve the given AI variable resolution request. When resolving dependencies with `resolveDependency`,
     * add the resolved dependencies to the result's `allResolvedDependencies` list
     * to enable consumers of the resolved variable to inspect dependencies.
     */
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext, resolveDependency: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable | undefined>;
}
export declare const AIVariableService: unique symbol;
export interface AIVariableService {
    hasVariable(name: string): boolean;
    getVariable(name: string): Readonly<AIVariable> | undefined;
    getVariables(): Readonly<AIVariable>[];
    getContextVariables(): Readonly<AIContextVariable>[];
    registerVariable(variable: AIVariable): Disposable;
    unregisterVariable(name: string): void;
    readonly onDidChangeVariables: Event<void>;
    registerResolver(variable: AIVariable, resolver: AIVariableResolver): Disposable;
    unregisterResolver(variable: AIVariable, resolver: AIVariableResolver): void;
    getResolver(name: string, arg: string | undefined, context: AIVariableContext): Promise<AIVariableResolver | undefined>;
    resolveVariable(variable: AIVariableArg, context: AIVariableContext, cache?: Map<string, ResolveAIVariableCacheEntry>): Promise<ResolvedAIVariable | undefined>;
    registerArgumentPicker(variable: AIVariable, argPicker: AIVariableArgPicker): Disposable;
    unregisterArgumentPicker(variable: AIVariable, argPicker: AIVariableArgPicker): void;
    getArgumentPicker(name: string, context: AIVariableContext): Promise<AIVariableArgPicker | undefined>;
    registerArgumentCompletionProvider(variable: AIVariable, argPicker: AIVariableArgCompletionProvider): Disposable;
    unregisterArgumentCompletionProvider(variable: AIVariable, argPicker: AIVariableArgCompletionProvider): void;
    getArgumentCompletionProvider(name: string): Promise<AIVariableArgCompletionProvider | undefined>;
}
/** Contributions on the frontend can optionally implement `FrontendVariableContribution`. */
export declare const AIVariableContribution: unique symbol;
export interface AIVariableContribution {
    registerVariables(service: AIVariableService): void;
}
export interface ResolveAIVariableCacheEntry {
    promise: Promise<ResolvedAIVariable | undefined>;
    inProgress: boolean;
}
export type ResolveAIVariableCache = Map<string, ResolveAIVariableCacheEntry>;
/**
 * Creates a new, empty cache for AI variable resolution to hand into `AIVariableService.resolveVariable`.
 */
export declare function createAIResolveVariableCache(): Map<string, ResolveAIVariableCacheEntry>;
/** Utility function to get all resolved AI variables from a {@link ResolveAIVariableCache}  */
export declare function getAllResolvedAIVariables(cache: ResolveAIVariableCache): Promise<ResolvedAIVariable[]>;
export declare class DefaultAIVariableService implements AIVariableService {
    protected readonly contributionProvider: ContributionProvider<AIVariableContribution>;
    protected readonly logger: ILogger;
    protected variables: Map<string, AIVariable>;
    protected resolvers: Map<string, AIVariableResolver[]>;
    protected argPickers: Map<string, AIVariableArgPicker>;
    protected openers: Map<string, AIVariableOpener[]>;
    protected argCompletionProviders: Map<string, AIVariableArgCompletionProvider>;
    protected readonly onDidChangeVariablesEmitter: any;
    readonly onDidChangeVariables: Event<void>;
    constructor(contributionProvider: ContributionProvider<AIVariableContribution>, logger: ILogger);
    protected initContributions(): void;
    protected getKey(name: string): string;
    getResolver(name: string, arg: string | undefined, context: AIVariableContext): Promise<AIVariableResolver | undefined>;
    protected getResolvers(name: string): AIVariableResolver[];
    protected prioritize(name: string, arg: string | undefined, context: AIVariableContext): Promise<AIVariableResolver[]>;
    hasVariable(name: string): boolean;
    getVariable(name: string): Readonly<AIVariable> | undefined;
    getVariables(): Readonly<AIVariable>[];
    getContextVariables(): Readonly<AIContextVariable>[];
    registerVariable(variable: AIVariable): Disposable;
    registerResolver(variable: AIVariable, resolver: AIVariableResolver): Disposable;
    unregisterResolver(variable: AIVariable, resolver: AIVariableResolver): void;
    unregisterVariable(name: string): void;
    registerArgumentPicker(variable: AIVariable, argPicker: AIVariableArgPicker): Disposable;
    unregisterArgumentPicker(variable: AIVariable, argPicker: AIVariableArgPicker): void;
    getArgumentPicker(name: string): Promise<AIVariableArgPicker | undefined>;
    registerArgumentCompletionProvider(variable: AIVariable, completionProvider: AIVariableArgCompletionProvider): Disposable;
    unregisterArgumentCompletionProvider(variable: AIVariable, completionProvider: AIVariableArgCompletionProvider): void;
    getArgumentCompletionProvider(name: string): Promise<AIVariableArgCompletionProvider | undefined>;
    protected parseRequest(request: AIVariableArg): {
        variableName: string;
        arg: string | undefined;
    };
    resolveVariable(request: AIVariableArg, context: AIVariableContext, cache?: ResolveAIVariableCache): Promise<ResolvedAIVariable | undefined>;
    /**
     * Asynchronously resolves a variable, handling its dependencies while preventing cyclical resolution.
     * Selects the appropriate resolver and resolution strategy based on whether nested dependency resolution is supported.
     */
    protected doResolve(variableName: string, arg: string | undefined, context: AIVariableContext, cache: ResolveAIVariableCache): Promise<ResolvedAIVariable | undefined>;
}
//# sourceMappingURL=variable-service.d.ts.map