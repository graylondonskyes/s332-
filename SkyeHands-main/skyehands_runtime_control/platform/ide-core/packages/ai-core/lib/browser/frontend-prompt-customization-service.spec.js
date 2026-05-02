"use strict";
// *****************************************************************************
// Copyright (C) 2025 EclipseSource and others.
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
const chai_1 = require("chai");
const prompttemplate_parser_1 = require("./prompttemplate-parser");
describe('Prompt Template Parser', () => {
    describe('YAML Front Matter Parsing', () => {
        it('extracts YAML front matter correctly', () => {
            const fileContent = `---
isCommand: true
commandName: hello
commandDescription: Say hello
commandArgumentHint: <name>
commandAgents:
  - Universal
  - Agent2
---
Template content here`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Template content here');
            (0, chai_1.expect)(result.metadata).to.not.be.undefined;
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.true;
            (0, chai_1.expect)(result.metadata?.commandName).to.equal('hello');
            (0, chai_1.expect)(result.metadata?.commandDescription).to.equal('Say hello');
            (0, chai_1.expect)(result.metadata?.commandArgumentHint).to.equal('<name>');
            (0, chai_1.expect)(result.metadata?.commandAgents).to.deep.equal(['Universal', 'Agent2']);
        });
        it('returns template without front matter when none exists', () => {
            const fileContent = 'Just a regular template';
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Just a regular template');
            (0, chai_1.expect)(result.metadata).to.be.undefined;
        });
        it('handles missing front matter gracefully', () => {
            const fileContent = `---
This is not valid YAML front matter
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            // Should return content as-is when front matter is invalid
            (0, chai_1.expect)(result.template).to.equal(fileContent);
        });
        it('handles invalid YAML gracefully', () => {
            const fileContent = `---
isCommand: true
commandName: [unclosed array
---
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            // Should return template without metadata on parse error
            (0, chai_1.expect)(result.template).to.equal(fileContent);
            (0, chai_1.expect)(result.metadata).to.be.undefined;
        });
        it('validates command metadata types', () => {
            const fileContent = `---
isCommand: "true"
commandName: 123
commandDescription: valid
commandArgumentHint: <arg>
commandAgents: "not-an-array"
---
Template`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Template');
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.undefined; // Wrong type
            (0, chai_1.expect)(result.metadata?.commandName).to.be.undefined; // Wrong type
            (0, chai_1.expect)(result.metadata?.commandDescription).to.equal('valid');
            (0, chai_1.expect)(result.metadata?.commandArgumentHint).to.equal('<arg>');
            (0, chai_1.expect)(result.metadata?.commandAgents).to.be.undefined; // Wrong type
        });
        it('filters commandAgents to strings only', () => {
            const fileContent = `---
commandAgents:
  - ValidAgent
  - 123
  - AnotherValid
  - true
  - LastValid
---
Template`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.metadata?.commandAgents).to.deep.equal(['ValidAgent', 'AnotherValid', 'LastValid']);
        });
        it('handles partial metadata fields', () => {
            const fileContent = `---
isCommand: true
commandName: test
---
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Template content');
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.true;
            (0, chai_1.expect)(result.metadata?.commandName).to.equal('test');
            (0, chai_1.expect)(result.metadata?.commandDescription).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.commandArgumentHint).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.commandAgents).to.be.undefined;
        });
        it('preserves template content with special characters', () => {
            const fileContent = `---
isCommand: true
---
Template with $ARGUMENTS and {{variable}} and ~{function}`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Template with $ARGUMENTS and {{variable}} and ~{function}');
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.true;
        });
        it('extracts name and description from front matter', () => {
            const fileContent = `---
name: My Fragment
description: A helpful description of this fragment
---
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.template).to.equal('Template content');
            (0, chai_1.expect)(result.metadata?.name).to.equal('My Fragment');
            (0, chai_1.expect)(result.metadata?.description).to.equal('A helpful description of this fragment');
        });
        it('extracts name and description alongside command metadata', () => {
            const fileContent = `---
name: App Tester
description: Delegate testing to AppTester
isCommand: true
commandName: apptester
---
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.metadata?.name).to.equal('App Tester');
            (0, chai_1.expect)(result.metadata?.description).to.equal('Delegate testing to AppTester');
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.true;
            (0, chai_1.expect)(result.metadata?.commandName).to.equal('apptester');
        });
        it('handles missing name and description gracefully', () => {
            const fileContent = `---
isCommand: true
---
Template content`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.metadata?.name).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.description).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.isCommand).to.be.true;
        });
        it('rejects non-string name and description', () => {
            const fileContent = `---
name: 42
description: true
---
Template`;
            const result = (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
            (0, chai_1.expect)(result.metadata?.name).to.be.undefined;
            (0, chai_1.expect)(result.metadata?.description).to.be.undefined;
        });
    });
});
//# sourceMappingURL=frontend-prompt-customization-service.spec.js.map