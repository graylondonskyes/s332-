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
const jsdom_1 = require("@theia/core/lib/browser/test/jsdom");
const disableJSDOM = (0, jsdom_1.enableJSDOM)();
const frontend_application_config_provider_1 = require("@theia/core/lib/browser/frontend-application-config-provider");
frontend_application_config_provider_1.FrontendApplicationConfigProvider.set({});
const chai_1 = require("chai");
const sinon = require("sinon");
const skill_1 = require("../common/skill");
const path_1 = require("@theia/core/lib/common/path");
const core_1 = require("@theia/core");
const skill_service_1 = require("./skill-service");
disableJSDOM();
describe('SkillService', () => {
    describe('tilde expansion', () => {
        it('should expand ~ to home directory in configured paths', () => {
            const homePath = '/home/testuser';
            const configuredDirectories = ['~/skills', '~/.theia/skills', '/absolute/path'];
            const expanded = configuredDirectories.map(dir => path_1.Path.untildify(dir, homePath));
            (0, chai_1.expect)(expanded).to.deep.equal([
                '/home/testuser/skills',
                '/home/testuser/.theia/skills',
                '/absolute/path'
            ]);
        });
        it('should handle empty home path gracefully', () => {
            const configuredDirectories = ['~/skills'];
            const expanded = configuredDirectories.map(dir => path_1.Path.untildify(dir, ''));
            // With empty home, tilde is not expanded
            (0, chai_1.expect)(expanded).to.deep.equal(['~/skills']);
        });
    });
    describe('directory prioritization', () => {
        it('workspace directory comes first when all directories provided', () => {
            const result = (0, skill_1.combineSkillDirectories)('/workspace/.prompts/skills', ['/custom/skills1', '/custom/skills2'], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal([
                '/workspace/.prompts/skills',
                '/custom/skills1',
                '/custom/skills2',
                '/home/user/.theia/skills'
            ]);
        });
        it('works without workspace directory', () => {
            const result = (0, skill_1.combineSkillDirectories)(undefined, ['/custom/skills'], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal([
                '/custom/skills',
                '/home/user/.theia/skills'
            ]);
        });
        it('works with only default directory', () => {
            const result = (0, skill_1.combineSkillDirectories)(undefined, [], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal(['/home/user/.theia/skills']);
        });
        it('deduplicates workspace directory if also in configured', () => {
            const result = (0, skill_1.combineSkillDirectories)('/workspace/.prompts/skills', ['/workspace/.prompts/skills', '/custom/skills'], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal([
                '/workspace/.prompts/skills',
                '/custom/skills',
                '/home/user/.theia/skills'
            ]);
        });
        it('deduplicates default directory if also in configured', () => {
            const result = (0, skill_1.combineSkillDirectories)('/workspace/.prompts/skills', ['/home/user/.theia/skills'], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal([
                '/workspace/.prompts/skills',
                '/home/user/.theia/skills'
            ]);
        });
        it('handles empty configured directories', () => {
            const result = (0, skill_1.combineSkillDirectories)('/workspace/.prompts/skills', [], '/home/user/.theia/skills');
            (0, chai_1.expect)(result).to.deep.equal([
                '/workspace/.prompts/skills',
                '/home/user/.theia/skills'
            ]);
        });
        it('handles undefined default directory', () => {
            const result = (0, skill_1.combineSkillDirectories)('/workspace/.prompts/skills', ['/custom/skills'], undefined);
            (0, chai_1.expect)(result).to.deep.equal([
                '/workspace/.prompts/skills',
                '/custom/skills'
            ]);
        });
    });
    describe('parseSkillFile', () => {
        it('extracts YAML front matter correctly', () => {
            const fileContent = `---
name: my-skill
description: A test skill for testing purposes
license: MIT
compatibility: ">=1.0.0"
metadata:
  author: test
  version: "1.0.0"
---
# My Skill

This is the skill content.`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.equal(`# My Skill

This is the skill content.`);
            (0, chai_1.expect)(result.metadata).to.not.be.undefined;
            (0, chai_1.expect)(result.metadata?.name).to.equal('my-skill');
            (0, chai_1.expect)(result.metadata?.description).to.equal('A test skill for testing purposes');
            (0, chai_1.expect)(result.metadata?.license).to.equal('MIT');
            (0, chai_1.expect)(result.metadata?.compatibility).to.equal('>=1.0.0');
            (0, chai_1.expect)(result.metadata?.metadata).to.deep.equal({ author: 'test', version: '1.0.0' });
        });
        it('returns content without metadata when no front matter exists', () => {
            const fileContent = '# Just a regular markdown file';
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.equal('# Just a regular markdown file');
            (0, chai_1.expect)(result.metadata).to.be.undefined;
        });
        it('handles missing front matter gracefully', () => {
            const fileContent = `---
This is not valid YAML front matter
Skill content`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.equal(fileContent);
            (0, chai_1.expect)(result.metadata).to.be.undefined;
        });
        it('handles invalid YAML gracefully', () => {
            const fileContent = `---
name: my-skill
description: [unclosed array
---
Skill content`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.equal(fileContent);
            (0, chai_1.expect)(result.metadata).to.be.undefined;
        });
        it('handles minimal required fields', () => {
            const fileContent = `---
name: minimal-skill
description: A minimal skill
---
Content`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.equal('Content');
            (0, chai_1.expect)(result.metadata?.name).to.equal('minimal-skill');
            (0, chai_1.expect)(result.metadata?.description).to.equal('A minimal skill');
            (0, chai_1.expect)(result.metadata?.license).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.compatibility).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.metadata).to.be.undefined;
        });
        it('handles allowedTools field', () => {
            const fileContent = `---
name: tool-skill
description: A skill with allowed tools
allowedTools:
  - tool1
  - tool2
---
Content`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.metadata?.allowedTools).to.deep.equal(['tool1', 'tool2']);
        });
        it('preserves markdown content with special characters', () => {
            const fileContent = `---
name: special-skill
description: Test
---
# Skill with {{variable}} and \`code\` and **bold**

\`\`\`javascript
const x = 1;
\`\`\``;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.content).to.contain('{{variable}}');
            (0, chai_1.expect)(result.content).to.contain('`code`');
            (0, chai_1.expect)(result.content).to.contain('**bold**');
            (0, chai_1.expect)(result.content).to.contain('const x = 1;');
        });
        it('handles empty content after front matter', () => {
            const fileContent = `---
name: empty-content
description: Skill with no content
---
`;
            const result = (0, skill_1.parseSkillFile)(fileContent);
            (0, chai_1.expect)(result.metadata?.name).to.equal('empty-content');
            (0, chai_1.expect)(result.content).to.equal('');
        });
    });
    describe('parent directory watching', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fileServiceMock;
        let loggerWarnSpy;
        let loggerInfoSpy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let envVariablesServerMock;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let workspaceServiceMock;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let preferencesMock;
        let fileChangesEmitter;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let preferenceChangedEmitter;
        function createService() {
            const service = new skill_service_1.DefaultSkillService();
            service.preferences = preferencesMock;
            service.fileService = fileServiceMock;
            const loggerMock = sinon.createStubInstance(core_1.Logger);
            loggerMock.warn = loggerWarnSpy;
            loggerMock.info = loggerInfoSpy;
            service.logger = loggerMock;
            service.envVariablesServer = envVariablesServerMock;
            service.workspaceService = workspaceServiceMock;
            return service;
        }
        beforeEach(() => {
            fileChangesEmitter = new core_1.Emitter();
            preferenceChangedEmitter = new core_1.Emitter();
            fileServiceMock = {
                exists: sinon.stub(),
                watch: sinon.stub().returns(core_1.Disposable.NULL),
                resolve: sinon.stub(),
                read: sinon.stub(),
                onDidFilesChange: (listener) => fileChangesEmitter.event(listener)
            };
            loggerWarnSpy = sinon.stub();
            loggerInfoSpy = sinon.stub();
            envVariablesServerMock = {
                getHomeDirUri: sinon.stub().resolves('file:///home/testuser'),
                getConfigDirUri: sinon.stub().resolves('file:///home/testuser/.theia-ide')
            };
            workspaceServiceMock = {
                ready: Promise.resolve(),
                tryGetRoots: sinon.stub().returns([]),
                onWorkspaceChanged: sinon.stub().returns(core_1.Disposable.NULL)
            };
            preferencesMock = {
                'ai-features.skills.skillDirectories': [],
                onPreferenceChanged: preferenceChangedEmitter.event
            };
        });
        afterEach(() => {
            sinon.restore();
            fileChangesEmitter.dispose();
            preferenceChangedEmitter.dispose();
        });
        it('should watch parent directory when skills directory does not exist', async () => {
            const service = createService();
            // Default skills directory does not exist, but parent does
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves(false);
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide'))
                .resolves(true);
            // Call init to trigger update
            service.init();
            await workspaceServiceMock.ready;
            // Allow async operations to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            // Verify parent directory is watched
            (0, chai_1.expect)(fileServiceMock.watch.calledWith(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide'), sinon.match({ recursive: false, excludes: [] }))).to.be.true;
            // Verify info log about watching parent
            (0, chai_1.expect)(loggerInfoSpy.calledWith(sinon.match(/Watching parent directory.*for skills folder creation/))).to.be.true;
        });
        it('should log warning when parent directory does not exist', async () => {
            const service = createService();
            // Neither skills directory nor parent exists
            fileServiceMock.exists.resolves(false);
            // Call init to trigger update
            service.init();
            await workspaceServiceMock.ready;
            await new Promise(resolve => setTimeout(resolve, 10));
            // Verify warning is logged about parent not existing
            (0, chai_1.expect)(loggerWarnSpy.calledWith(sinon.match(/Cannot watch skills directory.*parent directory does not exist/))).to.be.true;
        });
        it('should log warning for non-existent configured directories', async () => {
            const service = createService();
            // Set up configured directory that doesn't exist
            preferencesMock['ai-features.skills.skillDirectories'] = ['/custom/nonexistent/skills'];
            // Default skills directory exists (to avoid additional warnings)
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves(true);
            fileServiceMock.resolve
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves({ children: [] });
            // Configured directory does not exist
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/custom/nonexistent/skills'))
                .resolves(false);
            // Call init to trigger update
            service.init();
            await workspaceServiceMock.ready;
            await new Promise(resolve => setTimeout(resolve, 10));
            // Verify warning is logged for non-existent configured directory
            (0, chai_1.expect)(loggerWarnSpy.calledWith(sinon.match(/Configured skill directory.*does not exist/))).to.be.true;
        });
        it('should load skills when directory is created after initialization', async () => {
            const service = createService();
            // Initially, skills directory does not exist but parent does
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves(false);
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide'))
                .resolves(true);
            // Call init to trigger initial update
            service.init();
            await workspaceServiceMock.ready;
            await new Promise(resolve => setTimeout(resolve, 10));
            // Verify no skills initially
            (0, chai_1.expect)(service.getSkills()).to.have.length(0);
            // Now simulate skills directory being created with a skill
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves(true);
            fileServiceMock.resolve
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills'))
                .resolves({
                children: [{
                        isDirectory: true,
                        name: 'test-skill',
                        resource: core_1.URI.fromFilePath('/home/testuser/.theia-ide/skills/test-skill')
                    }]
            });
            fileServiceMock.exists
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills/test-skill/SKILL.md'))
                .resolves(true);
            fileServiceMock.read
                .withArgs(sinon.match((uri) => uri.path.toString() === '/home/testuser/.theia-ide/skills/test-skill/SKILL.md'))
                .resolves({
                value: `---
name: test-skill
description: A test skill
---
Test skill content`
            });
            // Simulate file change event for skills directory creation
            fileChangesEmitter.fire({
                changes: [{
                        type: 1, // FileChangeType.ADDED
                        resource: core_1.URI.fromFilePath('/home/testuser/.theia-ide/skills')
                    }],
                rawChanges: []
            });
            // Wait for async operations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            // Verify skill was loaded
            const skills = service.getSkills();
            (0, chai_1.expect)(skills).to.have.length(1);
            (0, chai_1.expect)(skills[0].name).to.equal('test-skill');
        });
    });
});
//# sourceMappingURL=skill-service.spec.js.map