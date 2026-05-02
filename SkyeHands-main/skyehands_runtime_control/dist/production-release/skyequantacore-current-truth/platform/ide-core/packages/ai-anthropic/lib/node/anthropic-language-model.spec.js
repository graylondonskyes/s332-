"use strict";
// *****************************************************************************
// Copyright (C) 2025 EclipseSource GmbH.
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
const chai_1 = require("chai");
const anthropic_language_model_1 = require("./anthropic-language-model");
describe('AnthropicModel', () => {
    describe('constructor', () => {
        it('should set default maxRetries to 3 when not provided', () => {
            const model = new anthropic_language_model_1.AnthropicModel('test-id', 'claude-3-opus-20240229', {
                status: 'ready'
            }, true, true, () => 'test-api-key', undefined, anthropic_language_model_1.DEFAULT_MAX_TOKENS);
            (0, chai_1.expect)(model.maxRetries).to.equal(3);
        });
        it('should set custom maxRetries when provided', () => {
            const customMaxRetries = 5;
            const model = new anthropic_language_model_1.AnthropicModel('test-id', 'claude-3-opus-20240229', {
                status: 'ready'
            }, true, true, () => 'test-api-key', undefined, anthropic_language_model_1.DEFAULT_MAX_TOKENS, customMaxRetries);
            (0, chai_1.expect)(model.maxRetries).to.equal(customMaxRetries);
        });
        it('should preserve all other constructor parameters', () => {
            const model = new anthropic_language_model_1.AnthropicModel('test-id', 'claude-3-opus-20240229', {
                status: 'ready'
            }, true, true, () => 'test-api-key', undefined, anthropic_language_model_1.DEFAULT_MAX_TOKENS, 5);
            (0, chai_1.expect)(model.id).to.equal('test-id');
            (0, chai_1.expect)(model.model).to.equal('claude-3-opus-20240229');
            (0, chai_1.expect)(model.enableStreaming).to.be.true;
            (0, chai_1.expect)(model.maxTokens).to.equal(anthropic_language_model_1.DEFAULT_MAX_TOKENS);
            (0, chai_1.expect)(model.maxRetries).to.equal(5);
        });
        it('should set custom url when provided', () => {
            const model = new anthropic_language_model_1.AnthropicModel('test-id', 'claude-3-opus-20240229', {
                status: 'ready'
            }, true, true, () => 'test-api-key', 'custom-url', anthropic_language_model_1.DEFAULT_MAX_TOKENS, 5);
            (0, chai_1.expect)(model.url).to.equal('custom-url');
        });
    });
    describe('addCacheControlToLastMessage', () => {
        it('should preserve all content blocks when adding cache control to parallel tool calls', () => {
            const messages = [
                {
                    role: 'user',
                    content: [
                        { type: 'tool_result', tool_use_id: 'tool1', content: 'result1' },
                        { type: 'tool_result', tool_use_id: 'tool2', content: 'result2' },
                        { type: 'tool_result', tool_use_id: 'tool3', content: 'result3' }
                    ]
                }
            ];
            const result = (0, anthropic_language_model_1.addCacheControlToLastMessage)(messages);
            (0, chai_1.expect)(result).to.have.lengthOf(1);
            (0, chai_1.expect)(result[0].content).to.be.an('array').with.lengthOf(3);
            (0, chai_1.expect)(result[0].content[0]).to.deep.equal({ type: 'tool_result', tool_use_id: 'tool1', content: 'result1' });
            (0, chai_1.expect)(result[0].content[1]).to.deep.equal({ type: 'tool_result', tool_use_id: 'tool2', content: 'result2' });
            (0, chai_1.expect)(result[0].content[2]).to.deep.equal({
                type: 'tool_result',
                tool_use_id: 'tool3',
                content: 'result3',
                cache_control: { type: 'ephemeral' }
            });
        });
        it('should add cache control to last non-thinking block in mixed content', () => {
            const messages = [
                {
                    role: 'assistant',
                    content: [
                        { type: 'text', text: 'Some text' },
                        { type: 'tool_use', id: 'tool1', name: 'getTool', input: {} },
                        { type: 'thinking', thinking: 'thinking content', signature: 'signature' }
                    ]
                }
            ];
            const result = (0, anthropic_language_model_1.addCacheControlToLastMessage)(messages);
            (0, chai_1.expect)(result).to.have.lengthOf(1);
            (0, chai_1.expect)(result[0].content).to.be.an('array').with.lengthOf(3);
            (0, chai_1.expect)(result[0].content[0]).to.deep.equal({ type: 'text', text: 'Some text' });
            (0, chai_1.expect)(result[0].content[1]).to.deep.equal({
                type: 'tool_use',
                id: 'tool1',
                name: 'getTool',
                input: {},
                cache_control: { type: 'ephemeral' }
            });
            (0, chai_1.expect)(result[0].content[2]).to.deep.equal({ type: 'thinking', thinking: 'thinking content', signature: 'signature' });
        });
        it('should handle string content by converting to content block', () => {
            const messages = [
                {
                    role: 'user',
                    content: 'Simple text message'
                }
            ];
            const result = (0, anthropic_language_model_1.addCacheControlToLastMessage)(messages);
            (0, chai_1.expect)(result).to.have.lengthOf(1);
            (0, chai_1.expect)(result[0].content).to.be.an('array').with.lengthOf(1);
            (0, chai_1.expect)(result[0].content[0]).to.deep.equal({
                type: 'text',
                text: 'Simple text message',
                cache_control: { type: 'ephemeral' }
            });
        });
        it('should not modify original messages', () => {
            const originalMessages = [
                {
                    role: 'user',
                    content: [
                        { type: 'tool_result', tool_use_id: 'tool1', content: 'result1' }
                    ]
                }
            ];
            (0, anthropic_language_model_1.addCacheControlToLastMessage)(originalMessages);
            (0, chai_1.expect)(originalMessages[0].content[0]).to.not.have.property('cache_control');
        });
    });
});
//# sourceMappingURL=anthropic-language-model.spec.js.map