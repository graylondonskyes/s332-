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
exports.AnthropicFrontendApplicationContribution = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("../common");
const anthropic_preferences_1 = require("../common/anthropic-preferences");
const ai_core_preferences_1 = require("@theia/ai-core/lib/common/ai-core-preferences");
const core_1 = require("@theia/core");
const ANTHROPIC_PROVIDER_ID = 'anthropic';
// Model-specific maxTokens values
const DEFAULT_MODEL_MAX_TOKENS = {
    'claude-3-opus-latest': 4096,
    'claude-3-5-haiku-latest': 8192,
    'claude-3-5-sonnet-latest': 8192,
    'claude-3-7-sonnet-latest': 64000,
    'claude-opus-4-20250514': 32000,
    'claude-sonnet-4-20250514': 64000,
    'claude-sonnet-4-5': 64000,
    'claude-sonnet-4-6': 64000,
    'claude-sonnet-4-0': 64000,
    'claude-opus-4-5': 64000,
    'claude-opus-4-6': 128000,
    'claude-opus-4-1': 32000
};
let AnthropicFrontendApplicationContribution = class AnthropicFrontendApplicationContribution {
    constructor() {
        this.prevModels = [];
        this.prevCustomModels = [];
    }
    onStart() {
        this.preferenceService.ready.then(() => {
            const apiKey = this.preferenceService.get(anthropic_preferences_1.API_KEY_PREF, undefined);
            this.manager.setApiKey(apiKey);
            const proxyUri = this.preferenceService.get('http.proxy', undefined);
            this.manager.setProxyUrl(proxyUri);
            const models = this.preferenceService.get(anthropic_preferences_1.MODELS_PREF, []);
            this.manager.createOrUpdateLanguageModels(...models.map(modelId => this.createAnthropicModelDescription(modelId)));
            this.prevModels = [...models];
            const customModels = this.preferenceService.get(anthropic_preferences_1.CUSTOM_ENDPOINTS_PREF, []);
            this.manager.createOrUpdateLanguageModels(...this.createCustomModelDescriptionsFromPreferences(customModels));
            this.prevCustomModels = [...customModels];
            this.preferenceService.onPreferenceChanged(event => {
                if (event.preferenceName === anthropic_preferences_1.API_KEY_PREF) {
                    this.manager.setApiKey(this.preferenceService.get(anthropic_preferences_1.API_KEY_PREF, undefined));
                    this.updateAllModels();
                }
                else if (event.preferenceName === anthropic_preferences_1.MODELS_PREF) {
                    this.handleModelChanges(this.preferenceService.get(anthropic_preferences_1.MODELS_PREF, []));
                }
                else if (event.preferenceName === 'http.proxy') {
                    this.manager.setProxyUrl(this.preferenceService.get('http.proxy', undefined));
                    this.updateAllModels();
                }
                else if (event.preferenceName === anthropic_preferences_1.CUSTOM_ENDPOINTS_PREF) {
                    this.handleCustomModelChanges(this.preferenceService.get(anthropic_preferences_1.CUSTOM_ENDPOINTS_PREF, []));
                }
            });
            this.aiCorePreferences.onPreferenceChanged(event => {
                if (event.preferenceName === ai_core_preferences_1.PREFERENCE_NAME_MAX_RETRIES) {
                    this.updateAllModels();
                }
            });
        });
    }
    handleModelChanges(newModels) {
        const oldModels = new Set(this.prevModels);
        const updatedModels = new Set(newModels);
        const modelsToRemove = [...oldModels].filter(model => !updatedModels.has(model));
        const modelsToAdd = [...updatedModels].filter(model => !oldModels.has(model));
        this.manager.removeLanguageModels(...modelsToRemove.map(model => `${ANTHROPIC_PROVIDER_ID}/${model}`));
        this.manager.createOrUpdateLanguageModels(...modelsToAdd.map(modelId => this.createAnthropicModelDescription(modelId)));
        this.prevModels = newModels;
    }
    handleCustomModelChanges(newCustomModels) {
        const oldModels = this.createCustomModelDescriptionsFromPreferences(this.prevCustomModels);
        const newModels = this.createCustomModelDescriptionsFromPreferences(newCustomModels);
        const modelsToRemove = oldModels.filter(model => !newModels.some(newModel => newModel.id === model.id));
        const modelsToAddOrUpdate = newModels.filter(newModel => !oldModels.some(model => model.id === newModel.id &&
            model.model === newModel.model &&
            model.url === newModel.url &&
            model.apiKey === newModel.apiKey &&
            model.maxRetries === newModel.maxRetries &&
            model.useCaching === newModel.useCaching &&
            model.enableStreaming === newModel.enableStreaming));
        this.manager.removeLanguageModels(...modelsToRemove.map(model => model.id));
        this.manager.createOrUpdateLanguageModels(...modelsToAddOrUpdate);
        this.prevCustomModels = [...newCustomModels];
    }
    updateAllModels() {
        const models = this.preferenceService.get(anthropic_preferences_1.MODELS_PREF, []);
        this.manager.createOrUpdateLanguageModels(...models.map(modelId => this.createAnthropicModelDescription(modelId)));
        const customModels = this.preferenceService.get(anthropic_preferences_1.CUSTOM_ENDPOINTS_PREF, []);
        this.manager.createOrUpdateLanguageModels(...this.createCustomModelDescriptionsFromPreferences(customModels));
    }
    createAnthropicModelDescription(modelId) {
        const id = `${ANTHROPIC_PROVIDER_ID}/${modelId}`;
        const maxTokens = DEFAULT_MODEL_MAX_TOKENS[modelId];
        const maxRetries = this.aiCorePreferences.get(ai_core_preferences_1.PREFERENCE_NAME_MAX_RETRIES) ?? 3;
        const description = {
            id: id,
            model: modelId,
            apiKey: true,
            enableStreaming: true,
            useCaching: true,
            maxRetries: maxRetries
        };
        if (maxTokens !== undefined) {
            description.maxTokens = maxTokens;
        }
        else {
            description.maxTokens = 64000;
        }
        return description;
    }
    createCustomModelDescriptionsFromPreferences(preferences) {
        const maxRetries = this.aiCorePreferences.get(ai_core_preferences_1.PREFERENCE_NAME_MAX_RETRIES) ?? 3;
        return preferences.reduce((acc, pref) => {
            if (!pref.model || !pref.url || typeof pref.model !== 'string' || typeof pref.url !== 'string') {
                return acc;
            }
            return [
                ...acc,
                {
                    id: pref.id && typeof pref.id === 'string' ? pref.id : pref.model,
                    model: pref.model,
                    url: pref.url,
                    apiKey: typeof pref.apiKey === 'string' || pref.apiKey === true ? pref.apiKey : undefined,
                    enableStreaming: pref.enableStreaming ?? true,
                    useCaching: pref.useCaching ?? true,
                    maxRetries: pref.maxRetries ?? maxRetries
                }
            ];
        }, []);
    }
};
exports.AnthropicFrontendApplicationContribution = AnthropicFrontendApplicationContribution;
tslib_1.__decorate([
    (0, inversify_1.inject)(core_1.PreferenceService),
    tslib_1.__metadata("design:type", typeof (_a = typeof core_1.PreferenceService !== "undefined" && core_1.PreferenceService) === "function" ? _a : Object)
], AnthropicFrontendApplicationContribution.prototype, "preferenceService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.AnthropicLanguageModelsManager),
    tslib_1.__metadata("design:type", Object)
], AnthropicFrontendApplicationContribution.prototype, "manager", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(ai_core_preferences_1.AICorePreferences),
    tslib_1.__metadata("design:type", typeof (_b = typeof ai_core_preferences_1.AICorePreferences !== "undefined" && ai_core_preferences_1.AICorePreferences) === "function" ? _b : Object)
], AnthropicFrontendApplicationContribution.prototype, "aiCorePreferences", void 0);
exports.AnthropicFrontendApplicationContribution = AnthropicFrontendApplicationContribution = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], AnthropicFrontendApplicationContribution);
//# sourceMappingURL=anthropic-frontend-application-contribution.js.map