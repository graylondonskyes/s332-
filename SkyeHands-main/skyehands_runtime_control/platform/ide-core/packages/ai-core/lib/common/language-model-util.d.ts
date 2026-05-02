import { LanguageModelResponse, ToolRequest } from './language-model';
import { LanguageModelMonitoredStreamResponse } from './language-model-interaction-model';
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
export declare const getTextOfResponse: (response: LanguageModelResponse | LanguageModelMonitoredStreamResponse) => Promise<string>;
export declare const getJsonOfResponse: (response: LanguageModelResponse | LanguageModelMonitoredStreamResponse) => Promise<unknown>;
export declare const getJsonOfText: (text: string) => unknown;
export declare const toolRequestToPromptText: (toolRequest: ToolRequest) => string;
//# sourceMappingURL=language-model-util.d.ts.map