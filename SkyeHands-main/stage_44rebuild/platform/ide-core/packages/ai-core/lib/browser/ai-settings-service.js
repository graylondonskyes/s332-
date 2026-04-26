"use strict";
var AISettingsServiceImpl_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISettingsServiceImpl = void 0;
const tslib_1 = require("tslib");
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
const core_1 = require("@theia/core");
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
let AISettingsServiceImpl = class AISettingsServiceImpl {
    constructor() {
        this.toDispose = new core_1.DisposableCollection();
        this.onDidChangeEmitter = new core_1.Emitter();
        this.onDidChange = this.onDidChangeEmitter.event;
    }
    static { AISettingsServiceImpl_1 = this; }
    static { this.PREFERENCE_NAME = 'ai-features.agentSettings'; }
    init() {
        this.toDispose.push(this.preferenceService.onPreferenceChanged(event => {
            if (event.preferenceName === AISettingsServiceImpl_1.PREFERENCE_NAME) {
                this.onDidChangeEmitter.fire();
            }
        }));
    }
    async updateAgentSettings(agent, agentSettings) {
        const settings = await this.getSettings();
        const toSet = { ...settings, [agent]: { ...settings[agent], ...agentSettings } };
        try {
            await this.preferenceService.updateValue(AISettingsServiceImpl_1.PREFERENCE_NAME, toSet);
        }
        catch (e) {
            this.onDidChangeEmitter.fire();
            this.logger.warn('Updating the preferences was unsuccessful: ' + e);
        }
    }
    async getAgentSettings(agent) {
        const settings = await this.getSettings();
        return settings[agent];
    }
    async getSettings() {
        await this.preferenceService.ready;
        return this.preferenceService.get(AISettingsServiceImpl_1.PREFERENCE_NAME, {});
    }
};
exports.AISettingsServiceImpl = AISettingsServiceImpl;
tslib_1.__decorate([
    (0, inversify_1.inject)(core_1.ILogger),
    tslib_1.__metadata("design:type", typeof (_a = typeof core_1.ILogger !== "undefined" && core_1.ILogger) === "function" ? _a : Object)
], AISettingsServiceImpl.prototype, "logger", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.PreferenceService),
    tslib_1.__metadata("design:type", typeof (_b = typeof common_1.PreferenceService !== "undefined" && common_1.PreferenceService) === "function" ? _b : Object)
], AISettingsServiceImpl.prototype, "preferenceService", void 0);
tslib_1.__decorate([
    (0, inversify_1.postConstruct)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], AISettingsServiceImpl.prototype, "init", null);
exports.AISettingsServiceImpl = AISettingsServiceImpl = AISettingsServiceImpl_1 = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], AISettingsServiceImpl);
//# sourceMappingURL=ai-settings-service.js.map