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
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSkillService = exports.SkillService = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const path_1 = require("@theia/core/lib/common/path");
const env_variables_1 = require("@theia/core/lib/common/env-variables");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const files_1 = require("@theia/filesystem/lib/common/files");
const browser_1 = require("@theia/workspace/lib/browser");
const ai_core_preferences_1 = require("../common/ai-core-preferences");
const skill_1 = require("../common/skill");
/** Debounce delay for coalescing rapid file system events */
const UPDATE_DEBOUNCE_MS = 50;
exports.SkillService = Symbol('SkillService');
let DefaultSkillService = class DefaultSkillService {
    constructor() {
        this.skills = new Map();
        this.toDispose = new core_1.DisposableCollection();
        this.watchedDirectories = new Set();
        this.parentWatchers = new Map();
        this.onSkillsChangedEmitter = new core_1.Emitter();
        this.onSkillsChanged = this.onSkillsChangedEmitter.event;
    }
    init() {
        this.fileService.onDidFilesChange(async (event) => {
            for (const change of event.changes) {
                if (change.type === files_1.FileChangeType.ADDED) {
                    const changeUri = change.resource.toString();
                    for (const [, skillsPath] of this.parentWatchers) {
                        const expectedSkillsUri = core_1.URI.fromFilePath(skillsPath).toString();
                        if (changeUri === expectedSkillsUri) {
                            this.scheduleUpdate();
                            return;
                        }
                    }
                }
                // Check for skills directory deletion - switch back to parent watching
                if (change.type === files_1.FileChangeType.DELETED) {
                    const changeUri = change.resource.toString();
                    if (this.watchedDirectories.has(changeUri)) {
                        this.scheduleUpdate();
                        return;
                    }
                }
            }
            const isRelevantChange = event.changes.some(change => {
                const changeUri = change.resource.toString();
                const isInWatchedDir = Array.from(this.watchedDirectories).some(dirUri => changeUri.startsWith(dirUri));
                if (!isInWatchedDir) {
                    return false;
                }
                // Trigger on SKILL.md changes or directory additions/deletions
                const isSkillFile = change.resource.path.base === skill_1.SKILL_FILE_NAME;
                const isDirectoryChange = change.type === files_1.FileChangeType.ADDED || change.type === files_1.FileChangeType.DELETED;
                return isSkillFile || isDirectoryChange;
            });
            if (isRelevantChange) {
                this.scheduleUpdate();
            }
        });
        // Wait for workspace to be ready before initial update
        this.workspaceService.ready.then(() => {
            this.update().then(() => {
                // Only after initial update, start listening for changes
                this.lastSkillDirectoriesValue = JSON.stringify(this.preferences[ai_core_preferences_1.PREFERENCE_NAME_SKILL_DIRECTORIES]);
                this.preferences.onPreferenceChanged(event => {
                    if (event.preferenceName === ai_core_preferences_1.PREFERENCE_NAME_SKILL_DIRECTORIES) {
                        const currentValue = JSON.stringify(this.preferences[ai_core_preferences_1.PREFERENCE_NAME_SKILL_DIRECTORIES]);
                        if (currentValue === this.lastSkillDirectoriesValue) {
                            return;
                        }
                        this.lastSkillDirectoriesValue = currentValue;
                        this.scheduleUpdate();
                    }
                });
                this.workspaceService.onWorkspaceChanged(() => {
                    this.scheduleUpdate();
                });
            });
        });
    }
    getSkills() {
        return Array.from(this.skills.values());
    }
    getSkill(name) {
        return this.skills.get(name);
    }
    scheduleUpdate() {
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
        }
        this.updateDebounceTimeout = setTimeout(() => {
            this.updateDebounceTimeout = undefined;
            this.update();
        }, UPDATE_DEBOUNCE_MS);
    }
    async update() {
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
            this.updateDebounceTimeout = undefined;
        }
        this.toDispose.dispose();
        const newDisposables = new core_1.DisposableCollection();
        const newSkills = new Map();
        const workspaceSkillsDir = this.getWorkspaceSkillsDirectoryPath();
        const homeDirUri = await this.envVariablesServer.getHomeDirUri();
        const homePath = new core_1.URI(homeDirUri).path.fsPath();
        const configuredDirectories = (this.preferences[ai_core_preferences_1.PREFERENCE_NAME_SKILL_DIRECTORIES] ?? [])
            .map(dir => path_1.Path.untildify(dir, homePath));
        const defaultSkillsDir = await this.getDefaultSkillsDirectoryPath();
        const newWatchedDirectories = new Set();
        const newParentWatchers = new Map();
        if (workspaceSkillsDir) {
            await this.processSkillDirectoryWithParentWatching(workspaceSkillsDir, newSkills, newDisposables, newWatchedDirectories, newParentWatchers);
        }
        for (const configuredDir of configuredDirectories) {
            const configuredDirUri = core_1.URI.fromFilePath(configuredDir).toString();
            if (!newWatchedDirectories.has(configuredDirUri)) {
                await this.processConfiguredSkillDirectory(configuredDir, newSkills, newDisposables, newWatchedDirectories);
            }
        }
        const defaultSkillsDirUri = core_1.URI.fromFilePath(defaultSkillsDir).toString();
        if (!newWatchedDirectories.has(defaultSkillsDirUri)) {
            await this.processSkillDirectoryWithParentWatching(defaultSkillsDir, newSkills, newDisposables, newWatchedDirectories, newParentWatchers);
        }
        if (newSkills.size > 0 && newSkills.size !== this.skills.size) {
            this.logger.info(`Loaded ${newSkills.size} skills`);
        }
        this.toDispose = newDisposables;
        this.skills = newSkills;
        this.watchedDirectories = newWatchedDirectories;
        this.parentWatchers = newParentWatchers;
        this.onSkillsChangedEmitter.fire();
    }
    getWorkspaceSkillsDirectoryPath() {
        const roots = this.workspaceService.tryGetRoots();
        if (roots.length === 0) {
            return undefined;
        }
        // Use primary workspace root
        return roots[0].resource.resolve('.prompts/skills').path.fsPath();
    }
    async getDefaultSkillsDirectoryPath() {
        const configDirUri = await this.envVariablesServer.getConfigDirUri();
        const configDir = new core_1.URI(configDirUri);
        return configDir.resolve('skills').path.fsPath();
    }
    async processSkillDirectoryWithParentWatching(directoryPath, skills, disposables, watchedDirectories, parentWatchers) {
        const dirURI = core_1.URI.fromFilePath(directoryPath);
        try {
            const dirExists = await this.fileService.exists(dirURI);
            if (dirExists) {
                await this.processExistingSkillDirectory(dirURI, skills, disposables, watchedDirectories);
            }
            else {
                const parentPath = dirURI.parent.path.fsPath();
                const parentURI = core_1.URI.fromFilePath(parentPath);
                const parentExists = await this.fileService.exists(parentURI);
                if (parentExists) {
                    const parentUriString = parentURI.toString();
                    disposables.push(this.fileService.watch(parentURI, { recursive: false, excludes: [] }));
                    parentWatchers.set(parentUriString, directoryPath);
                    this.logger.info(`Watching parent directory '${parentPath}' for skills folder creation`);
                }
                else {
                    this.logger.warn(`Cannot watch skills directory '${directoryPath}': parent directory does not exist`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Error processing directory '${directoryPath}': ${error}`);
        }
    }
    async processConfiguredSkillDirectory(directoryPath, skills, disposables, watchedDirectories) {
        const dirURI = core_1.URI.fromFilePath(directoryPath);
        try {
            const dirExists = await this.fileService.exists(dirURI);
            if (!dirExists) {
                this.logger.warn(`Configured skill directory '${directoryPath}' does not exist`);
                return;
            }
            await this.processExistingSkillDirectory(dirURI, skills, disposables, watchedDirectories);
        }
        catch (error) {
            this.logger.error(`Error processing configured directory '${directoryPath}': ${error}`);
        }
    }
    async processExistingSkillDirectory(dirURI, skills, disposables, watchedDirectories) {
        const stat = await this.fileService.resolve(dirURI);
        if (!stat.children) {
            return;
        }
        for (const child of stat.children) {
            if (child.isDirectory) {
                const directoryName = child.name;
                await this.loadSkillFromDirectory(child.resource, directoryName, skills);
            }
        }
        this.setupDirectoryWatcher(dirURI, disposables, watchedDirectories);
    }
    async loadSkillFromDirectory(directoryUri, directoryName, skills) {
        const skillFileUri = directoryUri.resolve(skill_1.SKILL_FILE_NAME);
        const fileExists = await this.fileService.exists(skillFileUri);
        if (!fileExists) {
            return;
        }
        try {
            const fileContent = await this.fileService.read(skillFileUri);
            const parsed = (0, skill_1.parseSkillFile)(fileContent.value);
            if (!parsed.metadata) {
                this.logger.warn(`Skill in '${directoryName}': SKILL.md file has no valid YAML frontmatter`);
                return;
            }
            if (!skill_1.SkillDescription.is(parsed.metadata)) {
                this.logger.warn(`Skill in '${directoryName}': Invalid skill description - missing required fields (name, description)`);
                return;
            }
            const validationErrors = (0, skill_1.validateSkillDescription)(parsed.metadata, directoryName);
            if (validationErrors.length > 0) {
                this.logger.warn(`Skill in '${directoryName}': ${validationErrors.join('; ')}`);
                return;
            }
            const skillName = parsed.metadata.name;
            if (skills.has(skillName)) {
                this.logger.warn(`Skill '${skillName}': Duplicate skill found in '${directoryName}', using first discovered instance`);
                return;
            }
            const skill = {
                ...parsed.metadata,
                location: skillFileUri.path.fsPath()
            };
            skills.set(skillName, skill);
        }
        catch (error) {
            this.logger.error(`Failed to load skill from '${directoryName}': ${error}`);
        }
    }
    setupDirectoryWatcher(dirURI, disposables, watchedDirectories) {
        disposables.push(this.fileService.watch(dirURI, { recursive: true, excludes: [] }));
        watchedDirectories.add(dirURI.toString());
    }
};
exports.DefaultSkillService = DefaultSkillService;
tslib_1.__decorate([
    (0, inversify_1.inject)(ai_core_preferences_1.AICorePreferences),
    tslib_1.__metadata("design:type", typeof (_a = typeof ai_core_preferences_1.AICorePreferences !== "undefined" && ai_core_preferences_1.AICorePreferences) === "function" ? _a : Object)
], DefaultSkillService.prototype, "preferences", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    tslib_1.__metadata("design:type", typeof (_b = typeof file_service_1.FileService !== "undefined" && file_service_1.FileService) === "function" ? _b : Object)
], DefaultSkillService.prototype, "fileService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(core_1.ILogger),
    (0, inversify_1.named)('SkillService'),
    tslib_1.__metadata("design:type", typeof (_c = typeof core_1.ILogger !== "undefined" && core_1.ILogger) === "function" ? _c : Object)
], DefaultSkillService.prototype, "logger", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(env_variables_1.EnvVariablesServer),
    tslib_1.__metadata("design:type", typeof (_d = typeof env_variables_1.EnvVariablesServer !== "undefined" && env_variables_1.EnvVariablesServer) === "function" ? _d : Object)
], DefaultSkillService.prototype, "envVariablesServer", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(browser_1.WorkspaceService),
    tslib_1.__metadata("design:type", typeof (_e = typeof browser_1.WorkspaceService !== "undefined" && browser_1.WorkspaceService) === "function" ? _e : Object)
], DefaultSkillService.prototype, "workspaceService", void 0);
tslib_1.__decorate([
    (0, inversify_1.postConstruct)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], DefaultSkillService.prototype, "init", null);
exports.DefaultSkillService = DefaultSkillService = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], DefaultSkillService);
//# sourceMappingURL=skill-service.js.map