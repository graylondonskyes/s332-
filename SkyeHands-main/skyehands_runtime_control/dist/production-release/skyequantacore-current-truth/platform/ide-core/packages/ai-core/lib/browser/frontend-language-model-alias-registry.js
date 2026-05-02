"use strict";
// *****************************************************************************
// Copyright (C) 2024-2025 EclipseSource GmbH.
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultLanguageModelAliasRegistry = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const common_1 = require("@theia/core/lib/common");
const ai_core_preferences_1 = require("../common/ai-core-preferences");
const promise_util_1 = require("@theia/core/lib/common/promise-util");
let DefaultLanguageModelAliasRegistry = class DefaultLanguageModelAliasRegistry {
    constructor() {
        this.aliases = [
            {
                id: 'default/code',
                defaultModelIds: [
                    'anthropic/claude-opus-4-6',
                    'openai/gpt-5.4',
                    'google/gemini-3.1-pro-preview'
                ],
                description: core_1.nls.localize('theia/ai/core/defaultModelAliases/code/description', 'Optimized for code understanding and generation tasks.')
            },
            {
                id: 'default/universal',
                defaultModelIds: [
                    'anthropic/claude-opus-4-6',
                    'openai/gpt-5.4',
                    'google/gemini-3.1-pro-preview'
                ],
                description: core_1.nls.localize('theia/ai/core/defaultModelAliases/universal/description', 'Well-balanced for both code and general language use.')
            },
            {
                id: 'default/code-completion',
                defaultModelIds: [
                    'anthropic/claude-sonnet-4-6',
                    'openai/gpt-5.4',
                    'google/gemini-3.1-pro-preview'
                ],
                description: core_1.nls.localize('theia/ai/core/defaultModelAliases/code-completion/description', 'Best suited for code autocompletion scenarios.')
            },
            {
                id: 'default/summarize',
                defaultModelIds: [
                    'anthropic/claude-opus-4-6',
                    'openai/gpt-5.4',
                    'google/gemini-3.1-pro-preview'
                ],
                description: core_1.nls.localize('theia/ai/core/defaultModelAliases/summarize/description', 'Models prioritized for summarization and condensation of content.')
            }
        ];
        this.onDidChangeEmitter = new core_1.Emitter();
        this.onDidChange = this.onDidChangeEmitter.event;
        this._ready = new promise_util_1.Deferred();
    }
    get ready() {
        return this._ready.promise;
    }
    init() {
        this.preferenceService.ready.then(() => {
            this.loadFromPreference();
            this.preferenceService.onPreferenceChanged(ev => {
                if (ev.preferenceName === ai_core_preferences_1.LANGUAGE_MODEL_ALIASES_PREFERENCE) {
                    this.loadFromPreference();
                }
            });
            this._ready.resolve();
        }, err => {
            this._ready.reject(err);
        });
    }
    addAlias(alias) {
        const idx = this.aliases.findIndex(a => a.id === alias.id);
        if (idx !== -1) {
            this.aliases[idx] = alias;
        }
        else {
            this.aliases.push(alias);
        }
        this.saveToPreference();
        this.onDidChangeEmitter.fire();
    }
    removeAlias(id) {
        const idx = this.aliases.findIndex(a => a.id === id);
        if (idx !== -1) {
            this.aliases.splice(idx, 1);
            this.saveToPreference();
            this.onDidChangeEmitter.fire();
        }
    }
    getAliases() {
        return [...this.aliases];
    }
    resolveAlias(id) {
        const alias = this.aliases.find(a => a.id === id);
        if (!alias) {
            return undefined;
        }
        if (alias.selectedModelId) {
            return [alias.selectedModelId];
        }
        return alias.defaultModelIds;
    }
    /**
     * Set the selected model for the given alias id.
     * Updates the alias' selectedModelId to the given modelId, persists, and fires onDidChange.
     */
    selectModelForAlias(aliasId, modelId) {
        const alias = this.aliases.find(a => a.id === aliasId);
        if (alias) {
            alias.selectedModelId = modelId;
            this.saveToPreference();
            this.onDidChangeEmitter.fire();
        }
    }
    /**
     * Load aliases from the persisted setting
     */
    loadFromPreference() {
        const stored = this.preferenceService.get(ai_core_preferences_1.LANGUAGE_MODEL_ALIASES_PREFERENCE) || {};
        this.aliases.forEach(alias => {
            if (stored[alias.id] && stored[alias.id].selectedModel) {
                alias.selectedModelId = stored[alias.id].selectedModel;
            }
            else {
                delete alias.selectedModelId;
            }
        });
    }
    /**
     * Persist the current aliases and their selected models to the setting
     */
    saveToPreference() {
        const map = {};
        for (const alias of this.aliases) {
            if (alias.selectedModelId) {
                map[alias.id] = { selectedModel: alias.selectedModelId };
            }
        }
        this.preferenceService.set(ai_core_preferences_1.LANGUAGE_MODEL_ALIASES_PREFERENCE, map, common_1.PreferenceScope.User);
    }
};
exports.DefaultLanguageModelAliasRegistry = DefaultLanguageModelAliasRegistry;
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.PreferenceService),
    tslib_1.__metadata("design:type", typeof (_a = typeof common_1.PreferenceService !== "undefined" && common_1.PreferenceService) === "function" ? _a : Object)
], DefaultLanguageModelAliasRegistry.prototype, "preferenceService", void 0);
tslib_1.__decorate([
    (0, inversify_1.postConstruct)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], DefaultLanguageModelAliasRegistry.prototype, "init", null);
exports.DefaultLanguageModelAliasRegistry = DefaultLanguageModelAliasRegistry = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], DefaultLanguageModelAliasRegistry);
//# sourceMappingURL=frontend-language-model-alias-registry.js.map