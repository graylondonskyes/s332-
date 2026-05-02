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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeThinkingModeSettings = exports.mergeRequestSettings = exports.FrontendLanguageModelServiceImpl = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@theia/core/lib/common");
const inversify_1 = require("@theia/core/shared/inversify");
const prioritizeable_1 = require("@theia/core/lib/common/prioritizeable");
const language_model_service_1 = require("../common/language-model-service");
const ai_core_preferences_1 = require("../common/ai-core-preferences");
let FrontendLanguageModelServiceImpl = class FrontendLanguageModelServiceImpl extends language_model_service_1.LanguageModelServiceImpl {
    async sendRequest(languageModel, languageModelRequest) {
        const requestSettings = this.preferenceService.get(ai_core_preferences_1.PREFERENCE_NAME_REQUEST_SETTINGS, []);
        const thinkingModeSettings = this.preferenceService.get(ai_core_preferences_1.PREFERENCE_NAME_THINKING_MODE, []);
        const ids = languageModel.id.split('/');
        const matchingSetting = (0, exports.mergeRequestSettings)(requestSettings, ids[1], ids[0], languageModelRequest.agentId);
        if (matchingSetting?.requestSettings) {
            // Merge the settings, with user request taking precedence
            languageModelRequest.settings = {
                ...matchingSetting.requestSettings,
                ...languageModelRequest.settings
            };
        }
        if (matchingSetting?.clientSettings) {
            // Merge the clientSettings, with user request taking precedence
            languageModelRequest.clientSettings = {
                ...matchingSetting.clientSettings,
                ...languageModelRequest.clientSettings
            };
        }
        const matchingThinkingMode = (0, exports.mergeThinkingModeSettings)(thinkingModeSettings, ids[1], ids[0], languageModelRequest.agentId);
        if (matchingThinkingMode?.thinkingMode && !languageModelRequest.thinkingMode) {
            languageModelRequest.thinkingMode = matchingThinkingMode.thinkingMode;
        }
        return super.sendRequest(languageModel, languageModelRequest);
    }
};
exports.FrontendLanguageModelServiceImpl = FrontendLanguageModelServiceImpl;
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.PreferenceService),
    tslib_1.__metadata("design:type", typeof (_a = typeof common_1.PreferenceService !== "undefined" && common_1.PreferenceService) === "function" ? _a : Object)
], FrontendLanguageModelServiceImpl.prototype, "preferenceService", void 0);
exports.FrontendLanguageModelServiceImpl = FrontendLanguageModelServiceImpl = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], FrontendLanguageModelServiceImpl);
const mergeRequestSettings = (requestSettings, modelId, providerId, agentId) => {
    const prioritizedSettings = prioritizeable_1.Prioritizeable.prioritizeAllSync(requestSettings, setting => (0, ai_core_preferences_1.getRequestSettingSpecificity)(setting, {
        modelId,
        providerId,
        agentId
    }));
    // merge all settings from lowest to highest, identical priorities will be overwritten by the following
    const matchingSetting = prioritizedSettings.reduceRight((acc, cur) => ({ ...acc, ...cur.value }), {});
    return matchingSetting;
};
exports.mergeRequestSettings = mergeRequestSettings;
const mergeThinkingModeSettings = (thinkingModeSettings, modelId, providerId, agentId) => {
    const prioritizedSettings = prioritizeable_1.Prioritizeable.prioritizeAllSync(thinkingModeSettings, setting => (0, ai_core_preferences_1.getRequestSettingSpecificity)(setting, {
        modelId,
        providerId,
        agentId
    }));
    const matchingSetting = prioritizedSettings.reduceRight((acc, cur) => {
        if (!acc) {
            return cur.value;
        }
        return {
            ...acc,
            thinkingMode: {
                ...acc.thinkingMode,
                ...cur.value.thinkingMode
            }
        };
    }, undefined);
    return matchingSetting;
};
exports.mergeThinkingModeSettings = mergeThinkingModeSettings;
//# sourceMappingURL=frontend-language-model-service.js.map