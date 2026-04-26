"use strict";
// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
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
var HoverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoverService = exports.HoverPosition = void 0;
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const common_1 = require("../common");
const browser_1 = require("./browser");
const markdown_renderer_1 = require("./markdown-rendering/markdown-renderer");
require("../../src/browser/style/hover-service.css");
// Threshold, in milliseconds, over which a mouse movement is not considered
// quick enough as to be ignored
const quickMouseThresholdMillis = 200;
var HoverPosition;
(function (HoverPosition) {
    function invertIfNecessary(position, target, host, totalWidth, totalHeight) {
        if (position === 'left') {
            if (target.left - host.width - 5 < 0) {
                return 'right';
            }
        }
        else if (position === 'right') {
            if (target.right + host.width + 5 > totalWidth) {
                return 'left';
            }
        }
        else if (position === 'top') {
            if (target.top - host.height - 5 < 0) {
                return 'bottom';
            }
        }
        else if (position === 'bottom') {
            if (target.bottom + host.height + 5 > totalHeight) {
                return 'top';
            }
        }
        return position;
    }
    HoverPosition.invertIfNecessary = invertIfNecessary;
})(HoverPosition || (exports.HoverPosition = HoverPosition = {}));
let HoverService = class HoverService {
    constructor() {
        this.lastHidHover = Date.now();
        this.disposeOnHide = new common_1.DisposableCollection();
    }
    static { HoverService_1 = this; }
    static { this.hostClassName = 'theia-hover'; }
    static { this.styleSheetId = 'theia-hover-style'; }
    get markdownRenderer() {
        this._markdownRenderer ||= this.markdownRendererFactory();
        return this._markdownRenderer;
    }
    get hoverHost() {
        if (!this._hoverHost) {
            this._hoverHost = document.createElement('div');
            this._hoverHost.classList.add(HoverService_1.hostClassName);
            this._hoverHost.style.position = 'absolute';
            this._hoverHost.setAttribute('popover', 'hint');
        }
        return this._hoverHost;
    }
    requestHover(request) {
        this.cancelHover();
        const delay = request.skipHoverDelay ? 0 : this.getHoverDelay();
        this.pendingTimeout = (0, common_1.disposableTimeout)(() => this.renderHover(request), delay);
        this.hoverTarget = request.target;
        this.listenForMouseOut();
        this.listenForMouseClick(request);
    }
    getHoverDelay() {
        return Date.now() - this.lastHidHover < quickMouseThresholdMillis
            ? 0
            : this.preferences.get('workbench.hover.delay', common_1.isOSX ? 1500 : 500);
    }
    async renderHover(request) {
        const host = this.hoverHost;
        let firstChild;
        const { target, content, position, cssClasses, interactive, onHide } = request;
        if (onHide) {
            this.disposeOnHide.push({ dispose: onHide.bind(request) });
        }
        if (cssClasses) {
            host.classList.add(...cssClasses);
        }
        if (content instanceof HTMLElement) {
            host.appendChild(content);
            firstChild = content;
        }
        else if (typeof content === 'string') {
            host.textContent = content;
        }
        else {
            const renderedContent = this.markdownRenderer.render(content);
            this.disposeOnHide.push(renderedContent);
            host.appendChild(renderedContent.element);
            firstChild = renderedContent.element;
        }
        // browsers might insert linebreaks when the hover appears at the edge of the window
        // resetting the position prevents that
        host.style.left = '0px';
        host.style.top = '0px';
        document.body.append(host);
        if (!host.matches(':popover-open')) {
            host.showPopover();
        }
        if (interactive) {
            // Add a click handler to the hover host to ensure clicks within the hover area work properly
            const clickHandler = (e) => {
                // Let click events within the hover area be processed by their handlers
                // but prevent them from triggering document handlers that might dismiss the tooltip
                e.stopImmediatePropagation();
            };
            host.addEventListener('click', clickHandler);
            this.disposeOnHide.push({ dispose: () => host.removeEventListener('click', clickHandler) });
        }
        if (request.visualPreview) {
            // If just a string is being rendered use the size of the outer box
            const width = firstChild ? firstChild.offsetWidth : this.hoverHost.offsetWidth;
            const visualPreview = request.visualPreview(width);
            if (visualPreview) {
                host.appendChild(visualPreview);
            }
        }
        await (0, browser_1.animationFrame)(); // Allow the browser to size the host
        const updatedPosition = this.setHostPosition(target, host, position);
        this.disposeOnHide.push({
            dispose: () => {
                this.lastHidHover = Date.now();
                host.classList.remove(updatedPosition);
                if (cssClasses) {
                    host.classList.remove(...cssClasses);
                }
            }
        });
    }
    setHostPosition(target, host, position) {
        const targetDimensions = target.getBoundingClientRect();
        const hostDimensions = host.getBoundingClientRect();
        const documentWidth = document.body.getBoundingClientRect().width;
        // document.body.getBoundingClientRect().height doesn't work as expected
        // scrollHeight will always be accurate here: https://stackoverflow.com/a/44077777
        const documentHeight = document.documentElement.scrollHeight;
        position = HoverPosition.invertIfNecessary(position, targetDimensions, hostDimensions, documentWidth, documentHeight);
        if (position === 'top' || position === 'bottom') {
            const targetMiddleWidth = targetDimensions.left + (targetDimensions.width / 2);
            const middleAlignment = targetMiddleWidth - (hostDimensions.width / 2);
            const furthestRight = Math.min(documentWidth - hostDimensions.width, middleAlignment);
            const left = Math.max(0, furthestRight);
            const top = position === 'top'
                ? targetDimensions.top - hostDimensions.height - 5
                : targetDimensions.bottom + 5;
            host.style.setProperty('--theia-hover-before-position', `${targetMiddleWidth - left - 5}px`);
            host.style.top = `${top}px`;
            host.style.left = `${left}px`;
        }
        else {
            const targetMiddleHeight = targetDimensions.top + (targetDimensions.height / 2);
            const middleAlignment = targetMiddleHeight - (hostDimensions.height / 2);
            const furthestTop = Math.min(documentHeight - hostDimensions.height, middleAlignment);
            const top = Math.max(0, furthestTop);
            const left = position === 'left'
                ? targetDimensions.left - hostDimensions.width - 5
                : targetDimensions.right + 5;
            host.style.setProperty('--theia-hover-before-position', `${targetMiddleHeight - top - 5}px`);
            host.style.left = `${left}px`;
            host.style.top = `${top}px`;
        }
        host.classList.add(position);
        return position;
    }
    listenForMouseOut() {
        const handleMouseLeave = (e) => {
            this.disposeOnHide.push((0, common_1.disposableTimeout)(() => {
                if (!this.hoverHost.matches(':hover') && !this.hoverTarget?.matches(':hover')) {
                    this.cancelHover();
                }
            }, quickMouseThresholdMillis));
        };
        this.hoverTarget?.addEventListener('mouseout', handleMouseLeave);
        this.hoverHost.addEventListener('mouseout', handleMouseLeave);
        this.disposeOnHide.push({
            dispose: () => {
                this.hoverTarget?.removeEventListener('mouseout', handleMouseLeave);
                this.hoverHost.removeEventListener('mouseout', handleMouseLeave);
            }
        });
    }
    cancelHover() {
        this.pendingTimeout?.dispose();
        this.unRenderHover();
        this.disposeOnHide.dispose();
        this.hoverTarget = undefined;
    }
    /**
     * Listen for mouse click (mousedown) events and handle them based on hover interactivity.
     * For non-interactive hovers, any mousedown cancels the hover immediately.
     * For interactive hovers, the hover remains visible to allow interaction with its elements.
     */
    listenForMouseClick(request) {
        const handleMouseDown = (e) => {
            if (this.hoverHost.contains(e.target)) {
                return;
            }
            if (!request.interactive) {
                this.cancelHover();
            }
        };
        document.addEventListener('mousedown', handleMouseDown, true);
        this.disposeOnHide.push({ dispose: () => document.removeEventListener('mousedown', handleMouseDown, true) });
    }
    unRenderHover() {
        if (this.hoverHost.matches(':popover-open')) {
            this.hoverHost.hidePopover();
        }
        this.hoverHost.remove();
        this.hoverHost.replaceChildren();
    }
};
exports.HoverService = HoverService;
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.PreferenceService),
    tslib_1.__metadata("design:type", Object)
], HoverService.prototype, "preferences", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(markdown_renderer_1.MarkdownRendererFactory),
    tslib_1.__metadata("design:type", Function)
], HoverService.prototype, "markdownRendererFactory", void 0);
exports.HoverService = HoverService = HoverService_1 = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], HoverService);
//# sourceMappingURL=hover-service.js.map