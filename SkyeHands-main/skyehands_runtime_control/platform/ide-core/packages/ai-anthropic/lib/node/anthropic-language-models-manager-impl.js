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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicLanguageModelsManagerImpl = void 0;
const tslib_1 = require("tslib");
const ai_core_1 = require("@theia/ai-core");
const node_1 = require("@theia/ai-core/lib/node");
const inversify_1 = require("@theia/core/shared/inversify");
const anthropic_language_model_1 = require("./anthropic-language-model");
let AnthropicLanguageModelsManagerImpl = class AnthropicLanguageModelsManagerImpl {
    get apiKey() {
        return this._apiKey ?? process.env.ANTHROPIC_API_KEY;
    }
    async createOrUpdateLanguageModels(...modelDescriptions) {
        for (const modelDescription of modelDescriptions) {
            const model = await this.languageModelRegistry.getLanguageModel(modelDescription.id);
            const apiKeyProvider = () => {
                if (modelDescription.apiKey === true) {
                    return this.apiKey;
                }
                if (modelDescription.apiKey) {
                    return modelDescription.apiKey;
                }
                return undefined;
            };
            const proxyUrl = (0, node_1.getProxyUrl)(modelDescription.url ?? 'https://api.anthropic.com', this._proxyUrl);
            // Determine status based on API key and custom url presence
            const status = this.calculateStatus(modelDescription, apiKeyProvider());
            if (model) {
                if (!(model instanceof anthropic_language_model_1.AnthropicModel)) {
                    console.warn(`Anthropic: model ${modelDescription.id} is not an Anthropic model`);
                    continue;
                }
                await this.languageModelRegistry.patchLanguageModel(modelDescription.id, {
                    model: modelDescription.model,
                    enableStreaming: modelDescription.enableStreaming,
                    url: modelDescription.url,
                    useCaching: modelDescription.useCaching,
                    apiKey: apiKeyProvider,
                    status,
                    maxTokens: modelDescription.maxTokens !== undefined ? modelDescription.maxTokens : anthropic_language_model_1.DEFAULT_MAX_TOKENS,
                    maxRetries: modelDescription.maxRetries,
                    proxy: proxyUrl
                });
            }
            else {
                this.languageModelRegistry.addLanguageModels([
                    new anthropic_language_model_1.AnthropicModel(modelDescription.id, modelDescription.model, status, modelDescription.enableStreaming, modelDescription.useCaching, apiKeyProvider, modelDescription.url, modelDescription.maxTokens, modelDescription.maxRetries, this.tokenUsageService, proxyUrl)
                ]);
            }
        }
    }
    removeLanguageModels(...modelIds) {
        this.languageModelRegistry.removeLanguageModels(modelIds);
    }
    setApiKey(apiKey) {
        if (apiKey) {
            this._apiKey = apiKey;
        }
        else {
            this._apiKey = undefined;
        }
    }
    setProxyUrl(proxyUrl) {
        if (proxyUrl) {
            this._proxyUrl = proxyUrl;
        }
        else {
            this._proxyUrl = undefined;
        }
    }
    /**
     * Returns the status for a language model based on the presence of an API key or custom url.
     */
    calculateStatus(modelDescription, effectiveApiKey) {
        // Always mark custom models (models with url) as ready for now as we do not know about API Key requirements
        if (modelDescription.url) {
            return { status: 'ready' };
        }
        return effectiveApiKey
            ? { status: 'ready' }
            : { status: 'unavailable', message: 'No Anthropic API key set' };
    }
};
exports.AnthropicLanguageModelsManagerImpl = AnthropicLanguageModelsManagerImpl;
tslib_1.__decorate([
    (0, inversify_1.inject)(ai_core_1.LanguageModelRegistry),
    tslib_1.__metadata("design:type", typeof (_a = typeof ai_core_1.LanguageModelRegistry !== "undefined" && ai_core_1.LanguageModelRegistry) === "function" ? _a : Object)
], AnthropicLanguageModelsManagerImpl.prototype, "languageModelRegistry", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(ai_core_1.TokenUsageService),
    tslib_1.__metadata("design:type", typeof (_b = typeof ai_core_1.TokenUsageService !== "undefined" && ai_core_1.TokenUsageService) === "function" ? _b : Object)
], AnthropicLanguageModelsManagerImpl.prototype, "tokenUsageService", void 0);
exports.AnthropicLanguageModelsManagerImpl = AnthropicLanguageModelsManagerImpl = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], AnthropicLanguageModelsManagerImpl);
//# sourceMappingURL=anthropic-language-models-manager-impl.js.map