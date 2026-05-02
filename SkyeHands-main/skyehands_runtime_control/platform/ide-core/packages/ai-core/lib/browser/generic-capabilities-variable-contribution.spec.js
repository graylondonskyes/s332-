"use strict";
// *****************************************************************************
// Copyright (C) 2026 EclipseSource and others.
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
let disableJSDOM = (0, jsdom_1.enableJSDOM)();
const frontend_application_config_provider_1 = require("@theia/core/lib/browser/frontend-application-config-provider");
frontend_application_config_provider_1.FrontendApplicationConfigProvider.set({});
require("reflect-metadata");
const chai_1 = require("chai");
const inversify_1 = require("inversify");
const generic_capabilities_variable_contribution_1 = require("./generic-capabilities-variable-contribution");
disableJSDOM();
describe('GenericCapabilitiesVariableContribution', () => {
    before(() => disableJSDOM = (0, jsdom_1.enableJSDOM)());
    after(() => disableJSDOM());
    let contribution;
    let container;
    beforeEach(() => {
        container = new inversify_1.Container();
        container.bind(generic_capabilities_variable_contribution_1.GenericCapabilitiesVariableContribution).toSelf().inSingletonScope();
        contribution = container.get(generic_capabilities_variable_contribution_1.GenericCapabilitiesVariableContribution);
    });
    describe('canResolve', () => {
        it('returns 1 for selected_skills variable', () => {
            const result = contribution.canResolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE }, {});
            (0, chai_1.expect)(result).to.equal(1);
        });
        it('returns 1 for selected_functions variable', () => {
            const result = contribution.canResolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_FUNCTIONS_VARIABLE }, {});
            (0, chai_1.expect)(result).to.equal(1);
        });
        it('returns 1 for selected_variables variable', () => {
            const result = contribution.canResolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_VARIABLES_VARIABLE }, {});
            (0, chai_1.expect)(result).to.equal(1);
        });
        it('returns -1 for unknown variables', () => {
            const result = contribution.canResolve({ variable: { id: 'unknown', name: 'unknown', description: 'unknown' } }, {});
            (0, chai_1.expect)(result).to.equal(-1);
        });
    });
    describe('resolve', () => {
        it('returns empty string when no selections exist', async () => {
            const context = {};
            const result = await contribution.resolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE }, context);
            (0, chai_1.expect)(result?.value).to.equal('');
        });
        it('returns empty string when selections array is empty', async () => {
            const context = {
                genericCapabilitySelections: {
                    skills: []
                }
            };
            const result = await contribution.resolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE }, context);
            (0, chai_1.expect)(result?.value).to.equal('');
        });
        it('returns empty string for skills when skillService is not available', async () => {
            const context = {
                genericCapabilitySelections: {
                    skills: ['skill1', 'skill2']
                }
            };
            const result = await contribution.resolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE }, context);
            // Without skillService, it returns empty
            (0, chai_1.expect)(result?.value).to.equal('');
        });
        it('returns correct variable in result', async () => {
            const context = {};
            const result = await contribution.resolve({ variable: generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE }, context);
            (0, chai_1.expect)(result?.variable).to.deep.equal(generic_capabilities_variable_contribution_1.SELECTED_SKILLS_VARIABLE);
        });
    });
});
//# sourceMappingURL=generic-capabilities-variable-contribution.spec.js.map