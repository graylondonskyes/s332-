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
exports.toolRequestToPromptText = exports.getJsonOfText = exports.getJsonOfResponse = exports.getTextOfResponse = void 0;
const language_model_1 = require("./language-model");
/**
 * Retrieves the text content from a `LanguageModelResponse` object.
 *
 * **Important:** For stream responses, the stream can only be consumed once. Calling this function multiple times on the same stream response will return an empty string (`''`)
 * on subsequent calls, as the stream will have already been consumed.
 *
 * @param {LanguageModelResponse} response - The response object, which may contain a text, stream, or parsed response.
 * @returns {Promise<string>} - A promise that resolves to the text content of the response.
 * @throws {Error} - Throws an error if the response type is not supported or does not contain valid text content.
 */
const getTextOfResponse = async (response) => {
    if ((0, language_model_1.isLanguageModelTextResponse)(response)) {
        return response.text;
    }
    else if ((0, language_model_1.isLanguageModelStreamResponse)(response)) {
        let result = '';
        for await (const chunk of response.stream) {
            result += ((0, language_model_1.isTextResponsePart)(chunk) && chunk.content) ? chunk.content : '';
        }
        return result;
    }
    else if ((0, language_model_1.isLanguageModelParsedResponse)(response)) {
        return response.content;
    }
    else if ('parts' in response) {
        // Handle monitored stream response
        let result = '';
        for (const chunk of response.parts) {
            result += ((0, language_model_1.isTextResponsePart)(chunk) && chunk.content) ? chunk.content : '';
        }
        return result;
    }
    throw new Error(`Invalid response type ${response}`);
};
exports.getTextOfResponse = getTextOfResponse;
const getJsonOfResponse = async (response) => {
    const text = await (0, exports.getTextOfResponse)(response);
    return (0, exports.getJsonOfText)(text);
};
exports.getJsonOfResponse = getJsonOfResponse;
const getJsonOfText = (text) => {
    if (text.startsWith('```json')) {
        const regex = /```json\s*([\s\S]*?)\s*```/g;
        let match;
        // eslint-disable-next-line no-null/no-null
        while ((match = regex.exec(text)) !== null) {
            try {
                return JSON.parse(match[1]);
            }
            catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        }
    }
    else if (text.startsWith('{') || text.startsWith('[')) {
        return JSON.parse(text);
    }
    throw new Error('Invalid response format');
};
exports.getJsonOfText = getJsonOfText;
const toolRequestToPromptText = (toolRequest) => `${toolRequest.id}`;
exports.toolRequestToPromptText = toolRequestToPromptText;
//# sourceMappingURL=language-model-util.js.map