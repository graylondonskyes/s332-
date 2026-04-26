"use strict";
// *****************************************************************************
// Copyright (C) 2017 TypeFox and others.
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
var MonacoEditorService_1;
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonacoEditorService = exports.ActiveMonacoEditorContribution = exports.MonacoEditorServiceFactory = exports.VSCodeThemeService = exports.VSCodeContextKeyService = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("@theia/core/shared/inversify");
const uri_1 = require("@theia/core/lib/common/uri");
const browser_1 = require("@theia/core/lib/browser");
const browser_2 = require("@theia/editor/lib/browser");
const monaco_editor_1 = require("./monaco-editor");
const monaco_to_protocol_converter_1 = require("./monaco-to-protocol-converter");
const monaco_editor_model_1 = require("./monaco-editor-model");
const standaloneCodeEditorService_1 = require("@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditorService");
const standaloneCodeEditor_1 = require("@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor");
const contextkey_1 = require("@theia/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey");
const themeService_1 = require("@theia/monaco-editor-core/esm/vs/platform/theme/common/themeService");
const core_1 = require("@theia/core");
(0, inversify_1.decorate)((0, inversify_1.injectable)(), standaloneCodeEditorService_1.StandaloneCodeEditorService);
exports.VSCodeContextKeyService = Symbol('VSCodeContextKeyService');
exports.VSCodeThemeService = Symbol('VSCodeThemeService');
exports.MonacoEditorServiceFactory = Symbol('MonacoEditorServiceFactory');
/**
 * contribution provider to extend the active editor handling to other editor types than just standalone editor widgets.
 */
exports.ActiveMonacoEditorContribution = Symbol('ActiveMonacoEditorContribution');
let MonacoEditorService = class MonacoEditorService extends standaloneCodeEditorService_1.StandaloneCodeEditorService {
    static { MonacoEditorService_1 = this; }
    static { this.ENABLE_PREVIEW_PREFERENCE = 'editor.enablePreview'; }
    constructor(contextKeyService, themeService) {
        super(contextKeyService, themeService);
    }
    /**
     * Monaco active editor is either focused or last focused editor.
     */
    getActiveCodeEditor() {
        let editor = monaco_editor_1.MonacoEditor.getCurrent(this.editors);
        if (!editor && browser_2.CustomEditorWidget.is(this.shell.activeWidget)) {
            const model = this.shell.activeWidget.modelRef.object;
            if (model?.editorTextModel instanceof monaco_editor_model_1.MonacoEditorModel) {
                editor = monaco_editor_1.MonacoEditor.findByDocument(this.editors, model.editorTextModel)[0];
            }
        }
        const candidate = editor?.getControl();
        // Since we extend a private super class, we have to check that the thing that matches the public interface also matches the private expectations the superclass.
        if (candidate instanceof standaloneCodeEditor_1.StandaloneCodeEditor) {
            return candidate;
        }
        for (const activeEditorProvider of this.activeMonacoEditorContribution.getContributions()) {
            const activeEditor = activeEditorProvider.getActiveEditor();
            if (activeEditor) {
                return activeEditor;
            }
        }
        /* eslint-disable-next-line no-null/no-null */
        return null;
    }
    async openCodeEditor(input, source, sideBySide) {
        const uri = new uri_1.default(input.resource.toString());
        const openerOptions = this.createEditorOpenerOptions(input, source, sideBySide);
        const widget = await (0, browser_1.open)(this.openerService, uri, openerOptions);
        const editorWidget = await this.findEditorWidgetByUri(widget, uri.toString());
        const candidate = monaco_editor_1.MonacoEditor.get(editorWidget)?.getControl();
        // Since we extend a private super class, we have to check that the thing that matches the public interface also matches the private expectations the superclass.
        // eslint-disable-next-line no-null/no-null
        return candidate instanceof standaloneCodeEditor_1.StandaloneCodeEditor ? candidate : null;
    }
    async findEditorWidgetByUri(widget, uriAsString) {
        if (widget instanceof browser_2.EditorWidget) {
            if (widget.editor.uri.toString() === uriAsString) {
                return widget;
            }
            return undefined;
        }
        if (browser_1.ApplicationShell.TrackableWidgetProvider.is(widget)) {
            for (const childWidget of widget.getTrackableWidgets()) {
                const editorWidget = await this.findEditorWidgetByUri(childWidget, uriAsString);
                if (editorWidget) {
                    return editorWidget;
                }
            }
        }
        return undefined;
    }
    createEditorOpenerOptions(input, source, sideBySide) {
        const mode = this.getEditorOpenMode(input);
        const widgetOptions = this.getWidgetOptions(source, sideBySide);
        const selection = this.getSelection(input);
        const preview = !!this.preferencesService.get(MonacoEditorService_1.ENABLE_PREVIEW_PREFERENCE, false);
        return { mode, widgetOptions, preview, selection };
    }
    getSelection(input) {
        if ('options' in input && input.options && 'selection' in input.options) {
            return this.m2p.asRange(input.options.selection);
        }
    }
    getEditorOpenMode(input) {
        const options = {
            preserveFocus: false,
            revealIfVisible: true,
            ...input.options
        };
        if (options.preserveFocus) {
            return 'reveal';
        }
        return options.revealIfVisible ? 'activate' : 'open';
    }
    getWidgetOptions(source, sideBySide) {
        const ref = monaco_editor_1.MonacoEditor.getWidgetFor(this.editors, source);
        if (!ref) {
            return undefined;
        }
        const area = (ref && this.shell.getAreaFor(ref)) || 'main';
        const mode = ref && sideBySide ? 'split-right' : undefined;
        if (area === 'secondaryWindow') {
            return { area: 'main', mode };
        }
        return { area, mode, ref };
    }
};
exports.MonacoEditorService = MonacoEditorService;
tslib_1.__decorate([
    (0, inversify_1.inject)(browser_1.OpenerService),
    tslib_1.__metadata("design:type", typeof (_c = typeof browser_1.OpenerService !== "undefined" && browser_1.OpenerService) === "function" ? _c : Object)
], MonacoEditorService.prototype, "openerService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(monaco_to_protocol_converter_1.MonacoToProtocolConverter),
    tslib_1.__metadata("design:type", monaco_to_protocol_converter_1.MonacoToProtocolConverter)
], MonacoEditorService.prototype, "m2p", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(browser_1.ApplicationShell),
    tslib_1.__metadata("design:type", typeof (_d = typeof browser_1.ApplicationShell !== "undefined" && browser_1.ApplicationShell) === "function" ? _d : Object)
], MonacoEditorService.prototype, "shell", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(browser_2.EditorManager),
    tslib_1.__metadata("design:type", typeof (_e = typeof browser_2.EditorManager !== "undefined" && browser_2.EditorManager) === "function" ? _e : Object)
], MonacoEditorService.prototype, "editors", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(core_1.PreferenceService),
    tslib_1.__metadata("design:type", typeof (_f = typeof core_1.PreferenceService !== "undefined" && core_1.PreferenceService) === "function" ? _f : Object)
], MonacoEditorService.prototype, "preferencesService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(core_1.ContributionProvider),
    (0, inversify_1.named)(exports.ActiveMonacoEditorContribution),
    tslib_1.__metadata("design:type", typeof (_g = typeof core_1.ContributionProvider !== "undefined" && core_1.ContributionProvider) === "function" ? _g : Object)
], MonacoEditorService.prototype, "activeMonacoEditorContribution", void 0);
exports.MonacoEditorService = MonacoEditorService = MonacoEditorService_1 = tslib_1.__decorate([
    (0, inversify_1.injectable)(),
    tslib_1.__param(0, (0, inversify_1.inject)(exports.VSCodeContextKeyService)),
    tslib_1.__param(1, (0, inversify_1.inject)(exports.VSCodeThemeService)),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof contextkey_1.IContextKeyService !== "undefined" && contextkey_1.IContextKeyService) === "function" ? _a : Object, typeof (_b = typeof themeService_1.IThemeService !== "undefined" && themeService_1.IThemeService) === "function" ? _b : Object])
], MonacoEditorService);
//# sourceMappingURL=monaco-editor-service.js.map