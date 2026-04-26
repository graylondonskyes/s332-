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
Object.defineProperty(exports, "__esModule", { value: true });
const language_model_1 = require("./language-model");
const chai_1 = require("chai");
describe('isModelMatching', () => {
    it('returns false with one of two parameter mismatches', () => {
        (0, chai_1.expect)((0, language_model_1.isModelMatching)({
            name: 'XXX',
            family: 'YYY',
        }, {
            name: 'gpt-4o',
            family: 'YYY',
        })).eql(false);
    });
    it('returns false with two parameter mismatches', () => {
        (0, chai_1.expect)((0, language_model_1.isModelMatching)({
            name: 'XXX',
            family: 'YYY',
        }, {
            name: 'gpt-4o',
            family: 'ZZZ',
        })).eql(false);
    });
    it('returns true with one parameter match', () => {
        (0, chai_1.expect)((0, language_model_1.isModelMatching)({
            name: 'gpt-4o',
        }, {
            name: 'gpt-4o',
        })).eql(true);
    });
    it('returns true with two parameter matches', () => {
        (0, chai_1.expect)((0, language_model_1.isModelMatching)({
            name: 'gpt-4o',
            family: 'YYY',
        }, {
            name: 'gpt-4o',
            family: 'YYY',
        })).eql(true);
    });
    it('returns true if there are no parameters in selector', () => {
        (0, chai_1.expect)((0, language_model_1.isModelMatching)({}, {
            name: 'gpt-4o',
            family: 'YYY',
        })).eql(true);
    });
});
//# sourceMappingURL=language-model.spec.js.map