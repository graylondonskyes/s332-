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

export interface OpenAIRequestApiContext {
    parent?: OpenAIRequestApiContext;
    requestId?: string;
    model?: string;
    startedAt?: number;
}

export class OpenAIRequestApiContext implements OpenAIRequestApiContext {
    parent?: OpenAIRequestApiContext;
    requestId: string;
    model: string;
    startedAt: number;

    constructor(options: { parent?: OpenAIRequestApiContext; model?: string; requestId?: string } = {}) {
        this.parent = options.parent;
        this.model = options.model ?? 'gpt-4o';
        this.requestId = options.requestId ?? `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        this.startedAt = Date.now();
    }

    child(overrides: { model?: string; requestId?: string } = {}): OpenAIRequestApiContext {
        return new OpenAIRequestApiContext({ parent: this, model: overrides.model ?? this.model, requestId: overrides.requestId });
    }

    elapsedMs(): number {
        return Date.now() - this.startedAt;
    }
}
