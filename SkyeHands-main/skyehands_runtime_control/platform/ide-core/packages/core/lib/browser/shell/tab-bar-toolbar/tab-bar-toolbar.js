"use strict";
// *****************************************************************************
// Copyright (C) 2018 TypeFox and others.
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
var TabBarToolbar_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabBarToolbar = exports.TabBarToolbarFactory = void 0;
exports.toAnchor = toAnchor;
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const React = require("react");
const context_key_service_1 = require("../../context-key-service");
const common_1 = require("../../../common");
const context_menu_renderer_1 = require("../../context-menu-renderer");
const label_parser_1 = require("../../label-parser");
const widgets_1 = require("../../widgets");
const tab_bar_toolbar_registry_1 = require("./tab-bar-toolbar-registry");
const tab_bar_toolbar_types_1 = require("./tab-bar-toolbar-types");
const keybinding_1 = require("../..//keybinding");
const menu_1 = require("../../../common/menu");
/**
 * Factory for instantiating tab-bar toolbars.
 */
exports.TabBarToolbarFactory = Symbol('TabBarToolbarFactory');
function toAnchor(event) {
    const itemBox = event.currentTarget.closest('.' + TabBarToolbar.Styles.TAB_BAR_TOOLBAR_ITEM)?.getBoundingClientRect();
    return itemBox ? { y: itemBox.bottom, x: itemBox.left } : event.nativeEvent;
}
/**
 * Tab-bar toolbar widget representing the active [tab-bar toolbar items](TabBarToolbarItem).
 */
let TabBarToolbar = TabBarToolbar_1 = class TabBarToolbar extends widgets_1.ReactWidget {
    constructor() {
        super();
        this.inline = new Map();
        this.more = new Map();
        this.toDisposeOnUpdateItems = new common_1.DisposableCollection();
        this.keybindingContextKeys = new Set();
        this.toDisposeOnSetCurrent = new common_1.DisposableCollection();
        this.showMoreContextMenu = (event) => {
            event.stopPropagation();
            event.preventDefault();
            const anchor = toAnchor(event);
            this.renderMoreContextMenu(anchor);
        };
        this.addClass(TabBarToolbar_1.Styles.TAB_BAR_TOOLBAR);
        this.hide();
    }
    init() {
        this.toDispose.pushAll([
            this.keybindings.onKeybindingsChanged(() => this.maybeUpdate()),
            this.contextKeyService.onDidChange(e => {
                if (e.affects(this.keybindingContextKeys)) {
                    this.maybeUpdate();
                }
            }),
            common_1.Disposable.create(() => {
                this.toDisposeOnUpdateItems.dispose();
                this.toDisposeOnSetCurrent.dispose();
            })
        ]);
    }
    updateItems(items, current) {
        this.toDisposeOnUpdateItems.dispose();
        this.toDisposeOnUpdateItems = new common_1.DisposableCollection();
        this.inline.clear();
        this.more.clear();
        for (const item of items.sort(tab_bar_toolbar_types_1.TabBarToolbarAction.PRIORITY_COMPARATOR).reverse()) {
            if (!('toMenuNode' in item) || item.group === undefined || item.group === 'navigation') {
                this.inline.set(item.id, item);
            }
            else {
                this.more.set(item.id, item);
            }
            if (item.onDidChange) {
                this.toDisposeOnUpdateItems.push(item.onDidChange(() => this.maybeUpdate()));
            }
        }
        this.setCurrent(current);
        if (items.length) {
            this.show();
        }
        else {
            this.hide();
        }
        this.maybeUpdate();
    }
    updateTarget(current) {
        const operativeWidget = tab_bar_toolbar_types_1.TabBarDelegator.is(current) ? current.getTabBarDelegate() : current;
        const items = operativeWidget ? this.toolbarRegistry.visibleItems(operativeWidget) : [];
        this.updateItems(items, operativeWidget);
    }
    setCurrent(current) {
        this.toDisposeOnSetCurrent.dispose();
        this.toDispose.push(this.toDisposeOnSetCurrent);
        this.current = current;
        if (current) {
            const resetCurrent = () => {
                this.setCurrent(undefined);
                this.maybeUpdate();
            };
            current.disposed.connect(resetCurrent);
            this.toDisposeOnSetCurrent.push(common_1.Disposable.create(() => current.disposed.disconnect(resetCurrent)));
        }
    }
    render() {
        this.keybindingContextKeys.clear();
        return React.createElement(React.Fragment, null,
            this.renderMore(),
            [...this.inline.values()].map(item => item.render(this.current)));
    }
    renderMore() {
        return !!this.more.size && React.createElement("div", { key: '__more__', className: TabBarToolbar_1.Styles.TAB_BAR_TOOLBAR_ITEM + ' enabled' },
            React.createElement("div", { id: '__more__', className: (0, widgets_1.codicon)('ellipsis', true), onClick: this.showMoreContextMenu, title: common_1.nls.localizeByDefault('More Actions...') }));
    }
    renderMoreContextMenu(anchor) {
        const toDisposeOnHide = new common_1.DisposableCollection();
        this.addClass('menu-open');
        toDisposeOnHide.push(common_1.Disposable.create(() => this.removeClass('menu-open')));
        const menu = new menu_1.GroupImpl('contextMenu');
        for (const item of this.more.values()) {
            if (item.toMenuNode) {
                const node = item.toMenuNode();
                if (node) {
                    if (item.group) {
                        menu.getOrCreate([item.group], 0, 1).addNode(node);
                    }
                    else {
                        menu.addNode(node);
                    }
                }
            }
        }
        return this.contextMenuRenderer.render({
            menu: menu_1.MenuModelRegistry.removeSingleRootNodes(menu),
            menuPath: tab_bar_toolbar_types_1.TAB_BAR_TOOLBAR_CONTEXT_MENU,
            args: [this.current],
            anchor,
            context: this.current?.node || this.node,
            contextKeyService: this.contextKeyService,
            includeAnchorArg: false,
            onHide: () => toDisposeOnHide.dispose()
        });
    }
    shouldHandleMouseEvent(event) {
        return event.target instanceof Element && this.node.contains(event.target);
    }
    commandIsEnabled(command) {
        return this.commands.isEnabled(command, this.current);
    }
    commandIsToggled(command) {
        return this.commands.isToggled(command, this.current);
    }
    evaluateWhenClause(whenClause) {
        return whenClause ? this.contextKeyService.match(whenClause, this.current?.node) : true;
    }
    maybeUpdate() {
        if (!this.isDisposed) {
            this.update();
        }
    }
};
exports.TabBarToolbar = TabBarToolbar;
tslib_1.__decorate([
    (0, inversify_1.inject)(common_1.CommandRegistry),
    tslib_1.__metadata("design:type", common_1.CommandRegistry)
], TabBarToolbar.prototype, "commands", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(label_parser_1.LabelParser),
    tslib_1.__metadata("design:type", label_parser_1.LabelParser)
], TabBarToolbar.prototype, "labelParser", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(menu_1.MenuModelRegistry),
    tslib_1.__metadata("design:type", menu_1.MenuModelRegistry)
], TabBarToolbar.prototype, "menus", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(context_menu_renderer_1.ContextMenuRenderer),
    tslib_1.__metadata("design:type", context_menu_renderer_1.ContextMenuRenderer)
], TabBarToolbar.prototype, "contextMenuRenderer", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(tab_bar_toolbar_registry_1.TabBarToolbarRegistry),
    tslib_1.__metadata("design:type", tab_bar_toolbar_registry_1.TabBarToolbarRegistry)
], TabBarToolbar.prototype, "toolbarRegistry", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(context_key_service_1.ContextKeyService),
    tslib_1.__metadata("design:type", Object)
], TabBarToolbar.prototype, "contextKeyService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(keybinding_1.KeybindingRegistry),
    tslib_1.__metadata("design:type", keybinding_1.KeybindingRegistry)
], TabBarToolbar.prototype, "keybindings", void 0);
tslib_1.__decorate([
    (0, inversify_1.postConstruct)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], TabBarToolbar.prototype, "init", null);
exports.TabBarToolbar = TabBarToolbar = TabBarToolbar_1 = tslib_1.__decorate([
    (0, inversify_1.injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], TabBarToolbar);
(function (TabBarToolbar) {
    let Styles;
    (function (Styles) {
        Styles.TAB_BAR_TOOLBAR = 'lm-TabBar-toolbar';
        Styles.TAB_BAR_TOOLBAR_ITEM = 'item';
    })(Styles = TabBarToolbar.Styles || (TabBarToolbar.Styles = {}));
})(TabBarToolbar || (exports.TabBarToolbar = TabBarToolbar = {}));
//# sourceMappingURL=tab-bar-toolbar.js.map