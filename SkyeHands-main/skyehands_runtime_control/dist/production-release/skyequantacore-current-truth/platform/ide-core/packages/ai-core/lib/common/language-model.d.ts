import { ContributionProvider, ILogger, Event, CancellationToken } from '@theia/core';
export type MessageActor = 'user' | 'ai' | 'system';
export interface ThinkingModeSettings {
    enabled: boolean;
    budgetTokens?: number;
}
export type LanguageModelMessage = TextMessage | ThinkingMessage | ToolUseMessage | ToolResultMessage | ImageMessage;
export declare namespace LanguageModelMessage {
    function isTextMessage(obj: LanguageModelMessage): obj is TextMessage;
    function isThinkingMessage(obj: LanguageModelMessage): obj is ThinkingMessage;
    function isToolUseMessage(obj: LanguageModelMessage): obj is ToolUseMessage;
    function isToolResultMessage(obj: LanguageModelMessage): obj is ToolResultMessage;
    function isImageMessage(obj: LanguageModelMessage): obj is ImageMessage;
}
export interface TextMessage {
    actor: MessageActor;
    type: 'text';
    text: string;
}
export interface ThinkingMessage {
    actor: 'ai';
    type: 'thinking';
    thinking: string;
    signature: string;
}
export interface ToolResultMessage {
    actor: 'user';
    tool_use_id: string;
    name: string;
    type: 'tool_result';
    content?: ToolCallResult;
    is_error?: boolean;
}
export interface ToolUseMessage {
    actor: 'ai';
    type: 'tool_use';
    id: string;
    input: unknown;
    name: string;
    data?: Record<string, string>;
}
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/bmp' | 'image/svg+xml' | string & {};
export interface UrlImageContent {
    url: string;
}
export interface Base64ImageContent {
    base64data: string;
    mimeType: ImageMimeType;
}
export type ImageContent = UrlImageContent | Base64ImageContent;
export declare namespace ImageContent {
    const isUrl: (obj: ImageContent) => obj is UrlImageContent;
    const isBase64: (obj: ImageContent) => obj is Base64ImageContent;
}
export interface ImageMessage {
    actor: 'ai' | 'user';
    type: 'image';
    image: ImageContent;
}
export declare const isLanguageModelRequestMessage: (obj: unknown) => obj is LanguageModelMessage;
export interface AutoActionResult {
    action: 'allow' | 'deny';
    reason?: string;
}
export interface ToolRequestParameterProperty {
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
    anyOf?: ToolRequestParameterProperty[];
    [key: string]: unknown;
}
export type ToolRequestParametersProperties = Record<string, ToolRequestParameterProperty>;
export interface ToolRequestParameters {
    type?: 'object';
    properties: ToolRequestParametersProperties;
    required?: string[];
}
/**
 * Defines a tool that can be invoked by language models.
 * @typeParam TContext - The context type passed to the handler. Defaults to ToolInvocationContext.
 */
export interface ToolRequest<TContext extends ToolInvocationContext = ToolInvocationContext> {
    id: string;
    name: string;
    parameters: ToolRequestParameters;
    description?: string;
    handler: (arg_string: string, ctx?: TContext) => Promise<ToolCallResult>;
    providerName?: string;
    /**
     * If set, this tool requires extra confirmation before auto-approval can be enabled.
     *
     * When a tool has this flag:
     * - It defaults to CONFIRM mode (not ALWAYS_ALLOW) even if global default is ALWAYS_ALLOW
     * - When user selects "Always Allow", an extra confirmation modal is shown
     * - The modal displays a warning about the tool's capabilities
     *
     * If a string is provided, it will be displayed as the custom warning message.
     * If true, a generic warning message will be shown.
     *
     * Use for tools with broad system access (shell execution, file deletion, etc.)
     */
    confirmAlwaysAllow?: boolean | string;
    /**
     * Optional method that returns a short, human-readable label for the tool's arguments
     * to display in the chat UI summary.
     *
     * @param args - The raw arguments JSON string passed to the tool.
     * @returns An object with:
     *  - `label`: A short text to display (e.g. the most important argument value).
     *  - `hasMore`: Whether there are additional arguments not shown in the label (renders as `...` suffix).
     *  Returns `undefined` if no short label can be determined.
     *  If this method is not provided, a generic condensed rendering of the arguments JSON is used as fallback.
     */
    getArgumentsShortLabel?(args: string): {
        label: string;
        hasMore: boolean;
    } | undefined;
    /**
     * Optional hook to determine automatic action for this tool invocation.
     * @param argString - The JSON argument string passed to the tool
     * @returns
     *   - { action: 'allow' } - Auto-approve without confirmation
     *   - { action: 'deny', reason } - Auto-deny without confirmation
     *   - undefined - Show confirmation UI (default behavior)
     */
    checkAutoAction?: (argString: string) => AutoActionResult | undefined;
}
/**
 * Context passed to tool handlers during invocation by language models.
 * Language models should pass this context when invoking tool handlers to enable
 * proper tracking and correlation of tool calls.
 */
export interface ToolInvocationContext {
    /**
     * The unique identifier for this specific tool call invocation.
     * This ID is assigned by the language model and used to correlate
     * the tool call with its response.
     */
    toolCallId?: string;
    /**
     * Optional cancellation token to support cancelling tool execution.
     */
    cancellationToken?: CancellationToken;
}
export declare namespace ToolInvocationContext {
    function is(obj: unknown): obj is ToolInvocationContext;
    /**
     * Creates a new ToolInvocationContext with the given tool call ID and optional cancellation token.
     */
    function create(toolCallId?: string, cancellationToken?: CancellationToken): ToolInvocationContext;
    /**
     * Extracts the tool call ID from an unknown context object.
     * Returns undefined if the context is not a valid ToolInvocationContext or has no toolCallId.
     */
    function getToolCallId(ctx: unknown): string | undefined;
    /**
     * Extracts the cancellation token from an unknown context object.
     */
    function getCancellationToken(ctx: unknown): CancellationToken | undefined;
}
export declare namespace ToolRequest {
    function isToolRequestParametersProperties(obj: unknown): obj is ToolRequestParametersProperties;
    function isToolRequestParameters(obj: unknown): obj is ToolRequestParameters;
}
export interface LanguageModelRequest {
    messages: LanguageModelMessage[];
    tools?: ToolRequest[];
    response_format?: {
        type: 'text';
    } | {
        type: 'json_object';
    } | ResponseFormatJsonSchema;
    settings?: {
        [key: string]: unknown;
    };
    clientSettings?: {
        keepToolCalls: boolean;
        keepThinking: boolean;
    };
    thinkingMode?: ThinkingModeSettings;
}
export interface ResponseFormatJsonSchema {
    type: 'json_schema';
    json_schema: {
        name: string;
        description?: string;
        schema?: Record<string, unknown>;
        strict?: boolean | null;
    };
}
/**
 * The UserRequest extends the "pure" LanguageModelRequest for cancelling support as well as
 * logging metadata.
 * The additional metadata might also be used for other use cases, for example to query default
 * request settings based on the agent id, merging with the request settings handed over.
 */
export interface UserRequest extends LanguageModelRequest {
    /**
     * Identifier of the Ai/ChatSession
     */
    sessionId: string;
    /**
     * Identifier of the request or overall exchange. Corresponds to request id in Chat sessions
     */
    requestId: string;
    /**
     * Id of a request in case a single exchange consists of multiple requests. In this case the requestId corresponds to the overall exchange.
     */
    subRequestId?: string;
    /**
     * Optional agent identifier in case the request was sent by an agent
     */
    agentId?: string;
    /**
     * Optional prompt variant ID used for this request
     */
    promptVariantId?: string;
    /**
     * Indicates whether the prompt variant was customized
     */
    isPromptVariantCustomized?: boolean;
    /**
     * Cancellation support
     */
    cancellationToken?: CancellationToken;
}
export interface LanguageModelTextResponse {
    text: string;
}
export declare const isLanguageModelTextResponse: (obj: unknown) => obj is LanguageModelTextResponse;
export type LanguageModelStreamResponsePart = TextResponsePart | ToolCallResponsePart | ThinkingResponsePart | UsageResponsePart;
export declare const isLanguageModelStreamResponsePart: (part: unknown) => part is LanguageModelStreamResponsePart;
export interface UsageResponsePart {
    input_tokens: number;
    output_tokens: number;
}
export declare const isUsageResponsePart: (part: unknown) => part is UsageResponsePart;
export interface TextResponsePart {
    content: string;
}
export declare const isTextResponsePart: (part: unknown) => part is TextResponsePart;
export interface ToolCallResponsePart {
    tool_calls: ToolCall[];
}
export declare const isToolCallResponsePart: (part: unknown) => part is ToolCallResponsePart;
export interface ThinkingResponsePart {
    thought: string;
    signature: string;
}
export declare const isThinkingResponsePart: (part: unknown) => part is ThinkingResponsePart;
export interface ToolCallTextResult {
    type: 'text';
    text: string;
}
export interface ToolCallImageResult extends Base64ImageContent {
    type: 'image';
}
export interface ToolCallAudioResult {
    type: 'audio';
    data: string;
    mimeType: string;
}
export type ToolCallErrorKind = 'tool-not-available';
export interface ToolCallErrorResult {
    type: 'error';
    data: string;
    errorKind?: ToolCallErrorKind;
}
export type ToolCallContentResult = ToolCallTextResult | ToolCallImageResult | ToolCallAudioResult | ToolCallErrorResult;
export interface ToolCallContent {
    content: ToolCallContentResult[];
}
export declare const isToolCallContent: (result: unknown) => result is ToolCallContent;
export declare const isToolCallErrorResult: (item: unknown) => item is ToolCallErrorResult;
export declare const isToolNotAvailableError: (item: unknown) => item is ToolCallErrorResult;
export declare const hasToolCallError: (result: ToolCallResult) => boolean;
export declare const hasToolNotAvailableError: (result: ToolCallResult) => boolean;
export declare const createToolCallError: (message: string, errorKind?: ToolCallErrorKind) => ToolCallContent;
export type ToolCallResult = undefined | object | string | ToolCallContent;
export interface ToolCall {
    id?: string;
    function?: {
        arguments?: string;
        name?: string;
    };
    finished?: boolean;
    result?: ToolCallResult;
    data?: Record<string, string>;
    /**
     * When true, the arguments field contains a delta to be appended
     * to existing arguments rather than a complete replacement.
     */
    argumentsDelta?: boolean;
}
export interface LanguageModelStreamResponse {
    stream: AsyncIterable<LanguageModelStreamResponsePart>;
}
export declare const isLanguageModelStreamResponse: (obj: unknown) => obj is LanguageModelStreamResponse;
export interface LanguageModelParsedResponse {
    parsed: unknown;
    content: string;
}
export declare const isLanguageModelParsedResponse: (obj: unknown) => obj is LanguageModelParsedResponse;
export type LanguageModelResponse = LanguageModelTextResponse | LanguageModelStreamResponse | LanguageModelParsedResponse;
export declare const LanguageModelProvider: unique symbol;
export type LanguageModelProvider = () => Promise<LanguageModel[]>;
export interface LanguageModelMetaData {
    readonly id: string;
    readonly name?: string;
    readonly vendor?: string;
    readonly version?: string;
    readonly family?: string;
    readonly maxInputTokens?: number;
    readonly maxOutputTokens?: number;
    readonly status: LanguageModelStatus;
}
export declare namespace LanguageModelMetaData {
    function is(arg: unknown): arg is LanguageModelMetaData;
}
export interface LanguageModelStatus {
    status: 'ready' | 'unavailable';
    message?: string;
}
export interface LanguageModel extends LanguageModelMetaData {
    request(request: UserRequest, cancellationToken?: CancellationToken): Promise<LanguageModelResponse>;
}
export declare namespace LanguageModel {
    function is(arg: unknown): arg is LanguageModel;
}
interface VsCodeLanguageModelSelector {
    readonly identifier?: string;
    readonly name?: string;
    readonly vendor?: string;
    readonly version?: string;
    readonly family?: string;
    readonly tokens?: number;
}
export interface LanguageModelSelector extends VsCodeLanguageModelSelector {
    readonly agent: string;
    readonly purpose: string;
}
export type LanguageModelRequirement = Omit<LanguageModelSelector, 'agent'>;
export declare const LanguageModelRegistry: unique symbol;
/**
 * Base interface for language model registries (frontend and backend).
 */
export interface LanguageModelRegistry {
    onChange: Event<{
        models: LanguageModel[];
    }>;
    addLanguageModels(models: LanguageModel[]): void;
    getLanguageModels(): Promise<LanguageModel[]>;
    getLanguageModel(id: string): Promise<LanguageModel | undefined>;
    removeLanguageModels(id: string[]): void;
    selectLanguageModel(request: LanguageModelSelector): Promise<LanguageModel | undefined>;
    selectLanguageModels(request: LanguageModelSelector): Promise<LanguageModel[] | undefined>;
    patchLanguageModel<T extends LanguageModel = LanguageModel>(id: string, patch: Partial<T>): Promise<void>;
}
export declare const FrontendLanguageModelRegistry: unique symbol;
/**
 * Frontend-specific language model registry interface (supports alias resolution).
 */
export interface FrontendLanguageModelRegistry extends LanguageModelRegistry {
    /**
     * If an id of a language model is provded, returns the LanguageModel if it is `ready`.
     * If an alias is provided, finds the highest-priority ready model from that alias.
     * If none are ready returns undefined.
     */
    getReadyLanguageModel(idOrAlias: string): Promise<LanguageModel | undefined>;
}
export declare class DefaultLanguageModelRegistryImpl implements LanguageModelRegistry {
    protected logger: ILogger;
    protected readonly languageModelContributions: ContributionProvider<LanguageModelProvider>;
    protected languageModels: LanguageModel[];
    protected markInitialized: () => void;
    protected initialized: Promise<void>;
    protected changeEmitter: any;
    onChange: any;
    protected init(): void;
    addLanguageModels(models: LanguageModel[]): void;
    getLanguageModels(): Promise<LanguageModel[]>;
    getLanguageModel(id: string): Promise<LanguageModel | undefined>;
    removeLanguageModels(ids: string[]): void;
    selectLanguageModels(request: LanguageModelSelector): Promise<LanguageModel[] | undefined>;
    selectLanguageModel(request: LanguageModelSelector): Promise<LanguageModel | undefined>;
    patchLanguageModel<T extends LanguageModel = LanguageModel>(id: string, patch: Partial<T>): Promise<void>;
}
export declare function isModelMatching(request: LanguageModelSelector, model: LanguageModel): boolean;
export {};
//# sourceMappingURL=language-model.d.ts.map