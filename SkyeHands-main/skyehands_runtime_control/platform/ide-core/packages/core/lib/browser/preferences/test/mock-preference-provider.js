"use strict";
// *****************************************************************************
// Copyright (C) 2019 Ericsson and others.
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
exports.MockPreferenceProvider = void 0;
exports.bindMockPreferenceProviders = bindMockPreferenceProviders;
const preferences_1 = require("../../../common/preferences");
class MockPreferenceProvider extends preferences_1.PreferenceProviderImpl {
    constructor(scope) {
        super();
        this.scope = scope;
        this.prefs = {};
    }
    markReady() {
        this._ready.resolve();
    }
    getPreferences() {
        return this.prefs;
    }
    setPreference(preferenceName, newValue, resourceUri) {
        const oldValue = this.prefs[preferenceName];
        this.prefs[preferenceName] = newValue;
        return this.emitPreferencesChangedEvent([{ preferenceName, oldValue, newValue, scope: this.scope, domain: [] }]);
    }
}
exports.MockPreferenceProvider = MockPreferenceProvider;
function bindMockPreferenceProviders(bind, unbind) {
    bind(preferences_1.PreferenceProvider).toDynamicValue(ctx => new MockPreferenceProvider(preferences_1.PreferenceScope.User)).inSingletonScope().whenTargetNamed(preferences_1.PreferenceScope.User);
    bind(preferences_1.PreferenceProvider).toDynamicValue(ctx => new MockPreferenceProvider(preferences_1.PreferenceScope.Workspace)).inSingletonScope().whenTargetNamed(preferences_1.PreferenceScope.Workspace);
    bind(preferences_1.PreferenceProvider).toDynamicValue(ctx => new MockPreferenceProvider(preferences_1.PreferenceScope.Folder)).inSingletonScope().whenTargetNamed(preferences_1.PreferenceScope.Folder);
}
//# sourceMappingURL=mock-preference-provider.js.map