"use strict";
// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
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
exports.SkillPromptCoordinator = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("@theia/core/shared/inversify");
const skill_service_1 = require("./skill-service");
const prompt_service_1 = require("../common/prompt-service");
let SkillPromptCoordinator = class SkillPromptCoordinator {
    constructor() {
        this.registeredSkillCommands = new Set();
    }
    onStart() {
        // Register initial skills
        this.updateSkillCommands();
        // Listen for skill changes
        this.skillService.onSkillsChanged(() => {
            this.updateSkillCommands();
        });
    }
    updateSkillCommands() {
        const currentSkills = this.skillService.getSkills();
        const currentSkillNames = new Set(currentSkills.map(s => s.name));
        // Unregister removed skills
        for (const name of this.registeredSkillCommands) {
            if (!currentSkillNames.has(name)) {
                this.promptService.removePromptFragment(`skill-command-${name}`);
                this.registeredSkillCommands.delete(name);
            }
        }
        // Register new skills
        for (const skill of currentSkills) {
            if (!this.registeredSkillCommands.has(skill.name)) {
                this.promptService.addBuiltInPromptFragment({
                    id: `skill-command-${skill.name}`,
                    template: `Load the skill ${skill.name} using ~{getSkillFileContent}.`,
                    isCommand: true,
                    commandName: skill.name,
                    commandDescription: skill.description
                });
                this.registeredSkillCommands.add(skill.name);
            }
        }
    }
};
exports.SkillPromptCoordinator = SkillPromptCoordinator;
tslib_1.__decorate([
    (0, inversify_1.inject)(skill_service_1.SkillService),
    tslib_1.__metadata("design:type", Object)
], SkillPromptCoordinator.prototype, "skillService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(prompt_service_1.PromptService),
    tslib_1.__metadata("design:type", Object)
], SkillPromptCoordinator.prototype, "promptService", void 0);
exports.SkillPromptCoordinator = SkillPromptCoordinator = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], SkillPromptCoordinator);
//# sourceMappingURL=skill-prompt-coordinator.js.map