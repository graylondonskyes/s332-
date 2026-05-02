"use strict";
// *****************************************************************************
// Copyright (C) 2023 TypeFox and others.
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
exports.PreferenceUtils = exports.PreferenceProvider = exports.PreferenceProviderDataChange = void 0;
const coreutils_1 = require("@lumino/coreutils");
const uri_1 = require("../uri");
var PreferenceProviderDataChange;
(function (PreferenceProviderDataChange) {
    function affects(change, resourceUri) {
        const resourcePath = resourceUri && new uri_1.URI(resourceUri).path;
        const domain = change.domain;
        return !resourcePath || !domain || domain.some(uri => new uri_1.URI(uri).path.relativity(resourcePath) >= 0);
    }
    PreferenceProviderDataChange.affects = affects;
})(PreferenceProviderDataChange || (exports.PreferenceProviderDataChange = PreferenceProviderDataChange = {}));
exports.PreferenceProvider = Symbol('PreferenceProvider');
var PreferenceUtils;
(function (PreferenceUtils) {
    function merge(source, target) {
        if (source === undefined || !coreutils_1.JSONExt.isObject(source)) {
            return coreutils_1.JSONExt.deepCopy(target);
        }
        if (coreutils_1.JSONExt.isPrimitive(target)) {
            return {};
        }
        for (const [key, value] of Object.entries(target)) {
            if (key in source) {
                const sourceValue = source[key];
                if (coreutils_1.JSONExt.isObject(sourceValue) && coreutils_1.JSONExt.isObject(value)) {
                    merge(sourceValue, value);
                    continue;
                }
                else if (coreutils_1.JSONExt.isArray(sourceValue) && coreutils_1.JSONExt.isArray(value)) {
                    source[key] = [...coreutils_1.JSONExt.deepCopy(sourceValue), ...coreutils_1.JSONExt.deepCopy(value)];
                    continue;
                }
            }
            source[key] = coreutils_1.JSONExt.deepCopy(value);
        }
        return source;
    }
    PreferenceUtils.merge = merge;
    /**
     * Handles deep equality with the possibility of `undefined`
     */
    function deepEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (a === undefined || b === undefined) {
            return false;
        }
        return coreutils_1.JSONExt.deepEqual(a, b);
    }
    PreferenceUtils.deepEqual = deepEqual;
})(PreferenceUtils || (exports.PreferenceUtils = PreferenceUtils = {}));
//# sourceMappingURL=preference-provider.js.map