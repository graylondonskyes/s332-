"use strict";
// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicModel = exports.AnthropicModelIdentifier = exports.DEFAULT_MAX_TOKENS = void 0;
exports.addCacheControlToLastMessage = addCacheControlToLastMessage;
const ai_core_1 = require("@theia/ai-core");
const core_1 = require("@theia/core");
const sdk_1 = require("@anthropic-ai/sdk");
const node_1 = require("@theia/ai-core/lib/node");
exports.DEFAULT_MAX_TOKENS = 4096;
const createMessageContent = (message) => {
    if (ai_core_1.LanguageModelMessage.isTextMessage(message)) {
        return [{ type: 'text', text: message.text }];
    }
    else if (ai_core_1.LanguageModelMessage.isThinkingMessage(message)) {
        return [{ signature: message.signature, thinking: message.thinking, type: 'thinking' }];
    }
    else if (ai_core_1.LanguageModelMessage.isToolUseMessage(message)) {
        return [{ id: message.id, input: message.input, name: message.name, type: 'tool_use' }];
    }
    else if (ai_core_1.LanguageModelMessage.isToolResultMessage(message)) {
        return [{ type: 'tool_result', tool_use_id: message.tool_use_id, content: formatToolCallResult(message.content) }];
    }
    else if (ai_core_1.LanguageModelMessage.isImageMessage(message)) {
        if (ai_core_1.ImageContent.isBase64(message.image)) {
            return [{ type: 'image', source: { type: 'base64', media_type: mimeTypeToMediaType(message.image.mimeType), data: message.image.base64data } }];
        }
        else {
            return [{ type: 'image', source: { type: 'url', url: message.image.url } }];
        }
    }
    throw new Error(`Unknown message type:'${JSON.stringify(message)}'`);
};
function mimeTypeToMediaType(mimeType) {
    switch (mimeType) {
        case 'image/gif':
            return 'image/gif';
        case 'image/jpeg':
            return 'image/jpeg';
        case 'image/png':
            return 'image/png';
        case 'image/webp':
            return 'image/webp';
        default:
            return 'image/jpeg';
    }
}
function isNonThinkingParam(content) {
    return content.type !== 'thinking' && content.type !== 'redacted_thinking';
}
/**
 * Transforms Theia language model messages to Anthropic API format
 * @param messages Array of LanguageModelRequestMessage to transform
 * @returns Object containing transformed messages and optional system message
 */
function transformToAnthropicParams(messages, addCacheControl = true) {
    // Extract the system message (if any), as it is a separate parameter in the Anthropic API.
    const systemMessageObj = messages.find(message => message.actor === 'system');
    const systemMessageText = systemMessageObj && ai_core_1.LanguageModelMessage.isTextMessage(systemMessageObj) && systemMessageObj.text || undefined;
    const systemMessage = systemMessageText ? [{ type: 'text', text: systemMessageText, cache_control: addCacheControl ? { type: 'ephemeral' } : undefined }] : undefined;
    const convertedMessages = messages
        .filter(message => message.actor !== 'system')
        .map(message => ({
        role: toAnthropicRole(message),
        content: createMessageContent(message)
    }));
    return {
        messages: convertedMessages,
        systemMessage,
    };
}
/**
 * If possible adds a cache control to the last message in the conversation.
 * This is used to enable incremental caching of the conversation.
 * @param messages The messages to process
 * @returns A new messages array with the last message adapted to include cache control. If no cache control can be added, the original messages are returned.
 * In any case, the original messages are not modified
 */
function addCacheControlToLastMessage(messages) {
    const clonedMessages = [...messages];
    const latestMessage = clonedMessages.pop();
    if (latestMessage) {
        if (typeof latestMessage.content === 'string') {
            // Wrap the string content into a content block with cache control
            const cachedContent = {
                type: 'text',
                text: latestMessage.content,
                cache_control: { type: 'ephemeral' }
            };
            return [...clonedMessages, { ...latestMessage, content: [cachedContent] }];
        }
        else if (Array.isArray(latestMessage.content)) {
            // Update the last non-thinking content block to include cache control
            const updatedContent = [...latestMessage.content];
            for (let i = updatedContent.length - 1; i >= 0; i--) {
                if (isNonThinkingParam(updatedContent[i])) {
                    updatedContent[i] = {
                        ...updatedContent[i],
                        cache_control: { type: 'ephemeral' }
                    };
                    return [...clonedMessages, { ...latestMessage, content: updatedContent }];
                }
            }
        }
    }
    return messages;
}
exports.AnthropicModelIdentifier = Symbol('AnthropicModelIdentifier');
/**
 * Converts Theia message actor to Anthropic role
 * @param message The message to convert
 * @returns Anthropic role ('user' or 'assistant')
 */
function toAnthropicRole(message) {
    switch (message.actor) {
        case 'ai':
            return 'assistant';
        default:
            return 'user';
    }
}
function formatToolCallResult(result) {
    if (typeof result === 'object' && result && 'content' in result && Array.isArray(result.content)) {
        return result.content.map(content => {
            if (content.type === 'text') {
                return { type: 'text', text: content.text };
            }
            else if (content.type === 'image') {
                return { type: 'image', source: { type: 'base64', data: content.base64data, media_type: mimeTypeToMediaType(content.mimeType) } };
            }
            else {
                return { type: 'text', text: content.data };
            }
        });
    }
    if ((0, core_1.isArray)(result)) {
        return result.map(r => ({ type: 'text', text: r }));
    }
    if (typeof result === 'object') {
        return JSON.stringify(result);
    }
    return result;
}
/**
 * Implements the Anthropic language model integration for Theia
 */
class AnthropicModel {
    constructor(id, model, status, enableStreaming, useCaching, apiKey, url, maxTokens = exports.DEFAULT_MAX_TOKENS, maxRetries = 3, tokenUsageService, proxy) {
        this.id = id;
        this.model = model;
        this.status = status;
        this.enableStreaming = enableStreaming;
        this.useCaching = useCaching;
        this.apiKey = apiKey;
        this.url = url;
        this.maxTokens = maxTokens;
        this.maxRetries = maxRetries;
        this.tokenUsageService = tokenUsageService;
        this.proxy = proxy;
    }
    getSettings(request) {
        const baseSettings = request.settings ?? {};
        if (request.thinkingMode?.enabled) {
            return {
                ...baseSettings,
                thinking: {
                    type: 'enabled',
                    budget_tokens: request.thinkingMode.budgetTokens ?? this.defaultThinkingBudget
                }
            };
        }
        return baseSettings;
    }
    get defaultThinkingBudget() {
        return 10000;
    }
    async request(request, cancellationToken) {
        if (!request.messages?.length) {
            throw new Error('Request must contain at least one message');
        }
        const anthropic = this.initializeAnthropic();
        try {
            if (this.enableStreaming) {
                return this.handleStreamingRequest(anthropic, request, cancellationToken);
            }
            return this.handleNonStreamingRequest(anthropic, request);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Anthropic API request failed: ${errorMessage}`);
        }
    }
    async handleStreamingRequest(anthropic, request, cancellationToken, toolMessages) {
        const settings = this.getSettings(request);
        const { messages, systemMessage } = transformToAnthropicParams(request.messages, this.useCaching);
        let anthropicMessages = [...messages, ...(toolMessages ?? [])];
        if (this.useCaching && anthropicMessages.length) {
            anthropicMessages = addCacheControlToLastMessage(anthropicMessages);
        }
        const tools = this.createTools(request);
        const params = {
            max_tokens: this.maxTokens,
            messages: anthropicMessages,
            tools,
            tool_choice: tools ? { type: 'auto' } : undefined,
            model: this.model,
            ...(systemMessage && { system: systemMessage }),
            ...settings
        };
        const stream = anthropic.messages.stream(params, { maxRetries: this.maxRetries });
        cancellationToken?.onCancellationRequested(() => {
            stream.abort();
        });
        const that = this;
        const asyncIterator = {
            async *[Symbol.asyncIterator]() {
                const toolCalls = [];
                let toolCall;
                const currentMessages = [];
                let currentMessage = undefined;
                for await (const event of stream) {
                    if (event.type === 'content_block_start') {
                        const contentBlock = event.content_block;
                        if (contentBlock.type === 'thinking') {
                            yield { thought: contentBlock.thinking, signature: contentBlock.signature ?? '' };
                        }
                        if (contentBlock.type === 'text') {
                            yield { content: contentBlock.text };
                        }
                        if (contentBlock.type === 'tool_use') {
                            toolCall = { name: contentBlock.name, args: '', id: contentBlock.id, index: event.index };
                            yield { tool_calls: [{ finished: false, id: toolCall.id, function: { name: toolCall.name, arguments: toolCall.args } }] };
                        }
                    }
                    else if (event.type === 'content_block_delta') {
                        const delta = event.delta;
                        if (delta.type === 'thinking_delta') {
                            yield { thought: delta.thinking, signature: '' };
                        }
                        if (delta.type === 'signature_delta') {
                            yield { thought: '', signature: delta.signature };
                        }
                        if (delta.type === 'text_delta') {
                            yield { content: delta.text };
                        }
                        if (toolCall && delta.type === 'input_json_delta') {
                            toolCall.args += delta.partial_json;
                            yield { tool_calls: [{ function: { arguments: delta.partial_json } }] };
                        }
                    }
                    else if (event.type === 'content_block_stop') {
                        if (toolCall && toolCall.index === event.index) {
                            toolCalls.push(toolCall);
                            toolCall = undefined;
                        }
                    }
                    else if (event.type === 'message_delta') {
                        if (event.delta.stop_reason === 'max_tokens') {
                            if (toolCall) {
                                yield { tool_calls: [{ finished: true, id: toolCall.id }] };
                            }
                            throw new Error(`The response was stopped because it exceeded the max token limit of ${event.usage.output_tokens}.`);
                        }
                    }
                    else if (event.type === 'message_start') {
                        currentMessages.push(event.message);
                        currentMessage = event.message;
                    }
                    else if (event.type === 'message_stop') {
                        if (currentMessage) {
                            yield { input_tokens: currentMessage.usage.input_tokens, output_tokens: currentMessage.usage.output_tokens };
                            // Record token usage if token usage service is available
                            if (that.tokenUsageService && currentMessage.usage) {
                                const tokenUsageParams = {
                                    inputTokens: currentMessage.usage.input_tokens,
                                    outputTokens: currentMessage.usage.output_tokens,
                                    cachedInputTokens: currentMessage.usage.cache_creation_input_tokens || undefined,
                                    readCachedInputTokens: currentMessage.usage.cache_read_input_tokens || undefined,
                                    requestId: request.requestId
                                };
                                await that.tokenUsageService.recordTokenUsage(that.id, tokenUsageParams);
                            }
                        }
                    }
                }
                if (toolCalls.length > 0) {
                    const toolResult = await Promise.all(toolCalls.map(async (tc) => {
                        const tool = request.tools?.find(t => t.name === tc.name);
                        const argsObject = tc.args.length === 0 ? '{}' : tc.args;
                        const handlerResult = tool
                            ? await tool.handler(argsObject, ai_core_1.ToolInvocationContext.create(tc.id))
                            : (0, ai_core_1.createToolCallError)(`Tool '${tc.name}' not found in the available tools for this request.`, 'tool-not-available');
                        return { name: tc.name, result: handlerResult, id: tc.id, arguments: argsObject };
                    }));
                    const calls = toolResult.map(tr => ({ finished: true, id: tr.id, result: tr.result, function: { name: tr.name, arguments: tr.arguments } }));
                    yield { tool_calls: calls };
                    const toolResponseMessage = {
                        role: 'user',
                        content: toolResult.map(call => ({
                            type: 'tool_result',
                            tool_use_id: call.id,
                            content: formatToolCallResult(call.result)
                        }))
                    };
                    const result = await that.handleStreamingRequest(anthropic, request, cancellationToken, [
                        ...(toolMessages ?? []),
                        ...currentMessages.map(m => ({ role: m.role, content: m.content })),
                        toolResponseMessage
                    ]);
                    for await (const nestedEvent of result.stream) {
                        yield nestedEvent;
                    }
                }
            },
        };
        stream.on('error', (error) => {
            console.error('Error in Anthropic streaming:', error);
        });
        return { stream: asyncIterator };
    }
    createTools(request) {
        if (request.tools?.length === 0) {
            return undefined;
        }
        const tools = request.tools?.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters
        }));
        if (this.useCaching) {
            if (tools?.length) {
                tools[tools.length - 1].cache_control = { type: 'ephemeral' };
            }
        }
        return tools;
    }
    async handleNonStreamingRequest(anthropic, request) {
        const settings = this.getSettings(request);
        const { messages, systemMessage } = transformToAnthropicParams(request.messages);
        const params = {
            max_tokens: this.maxTokens,
            messages,
            model: this.model,
            ...(systemMessage && { system: systemMessage }),
            ...settings,
        };
        try {
            const response = await anthropic.messages.create(params);
            const textContent = response.content[0];
            // Record token usage if token usage service is available
            if (this.tokenUsageService && response.usage) {
                const tokenUsageParams = {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                    requestId: request.requestId
                };
                await this.tokenUsageService.recordTokenUsage(this.id, tokenUsageParams);
            }
            if (textContent?.type === 'text') {
                return { text: textContent.text };
            }
            return { text: '' };
        }
        catch (error) {
            throw new Error(`Failed to get response from Anthropic API: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    initializeAnthropic() {
        const apiKey = this.apiKey();
        if (!apiKey && !(this.url)) {
            throw new Error('Please provide ANTHROPIC_API_KEY in preferences or via environment variable');
        }
        // We need to hand over "some" key, even if a custom url is not key protected as otherwise the Anthropic client will throw an error
        const key = apiKey ?? 'no-key';
        return new sdk_1.Anthropic({ apiKey: key, baseURL: this.url, fetch: (0, node_1.createProxyFetch)(this.proxy) });
    }
}
exports.AnthropicModel = AnthropicModel;
//# sourceMappingURL=anthropic-language-model.js.map