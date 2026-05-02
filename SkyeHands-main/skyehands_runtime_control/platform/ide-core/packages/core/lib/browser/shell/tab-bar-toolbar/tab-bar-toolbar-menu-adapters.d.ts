import { Widget } from '@lumino/widgets';
import * as React from 'react';
import { CommandRegistry, Event } from '../../../common';
import { RenderedToolbarAction } from './tab-bar-toolbar-types';
import { ContextMenuRenderer } from '../../context-menu-renderer';
import { TabBarToolbarItem } from './tab-toolbar-item';
import { ContextKeyService, ContextMatcher } from '../../context-key-service';
import { CommandMenu, CompoundMenuNode, Group, MenuModelRegistry, MenuNode, MenuPath, Submenu } from '../../../common/menu';
export declare const TOOLBAR_WRAPPER_ID_SUFFIX = "-as-tabbar-toolbar-item";
declare abstract class AbstractToolbarMenuWrapper {
    readonly effectiveMenuPath: MenuPath;
    protected readonly commandRegistry: CommandRegistry;
    protected readonly menuRegistry: MenuModelRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected readonly contextMenuRenderer: ContextMenuRenderer;
    constructor(effectiveMenuPath: MenuPath, commandRegistry: CommandRegistry, menuRegistry: MenuModelRegistry, contextKeyService: ContextKeyService, contextMenuRenderer: ContextMenuRenderer);
    protected abstract menuNode: MenuNode | undefined;
    protected abstract id: string;
    protected abstract icon: string | undefined;
    protected abstract tooltip: string | undefined;
    protected abstract text: string | undefined;
    protected abstract executeCommand(widget: Widget, e: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
    isEnabled(widget: Widget): boolean;
    isToggled(widget: Widget): boolean;
    render(widget: Widget): React.ReactNode;
    abstract toMenuNode(): MenuNode | undefined;
    /**
     * Presents the menu to popup on the `event` that is the clicking of
     * a menu toolbar item.
     *
     * @param menuPath the path of the registered menu to show
     * @param event the mouse event triggering the menu
     */
    showPopupMenu(widget: Widget | undefined, menuPath: MenuPath, event: React.MouseEvent, contextMatcher: ContextMatcher): void;
    /**
     * Renders a toolbar item that is a menu, presenting it as a button with a little
     * chevron decoration that pops up a floating menu when clicked.
     *
     * @param item a toolbar item that is a menu item
     * @returns the rendered toolbar item
     */
    protected renderMenuItem(widget: Widget): React.ReactNode;
}
export declare class SubmenuAsToolbarItemWrapper extends AbstractToolbarMenuWrapper implements TabBarToolbarItem {
    protected readonly menuNode: Submenu;
    readonly group: string | undefined;
    constructor(effectiveMenuPath: MenuPath, commandRegistry: CommandRegistry, menuRegistry: MenuModelRegistry, contextKeyService: ContextKeyService, contextMenuRenderer: ContextMenuRenderer, menuNode: Submenu, group: string | undefined);
    priority?: number | undefined;
    executeCommand(widget: Widget, e: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
    isVisible(widget: Widget): boolean;
    get id(): string;
    get icon(): string | undefined;
    get tooltip(): string | undefined;
    get text(): string | undefined;
    get onDidChange(): Event<void> | undefined;
    toMenuNode(): Group | undefined;
}
export declare class CommandMenuAsToolbarItemWrapper extends AbstractToolbarMenuWrapper implements TabBarToolbarItem {
    protected readonly menuNode: CommandMenu;
    readonly group: string | undefined;
    constructor(effectiveMenuPath: MenuPath, commandRegistry: CommandRegistry, menuRegistry: MenuModelRegistry, contextKeyService: ContextKeyService, contextMenuRenderer: ContextMenuRenderer, menuNode: CommandMenu, group: string | undefined);
    isVisible(widget: Widget): boolean;
    executeCommand(widget: Widget, e: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
    get id(): string;
    get icon(): string | undefined;
    get tooltip(): string | undefined;
    get text(): string | undefined;
    get onDidChange(): Event<void> | undefined;
    toMenuNode(): MenuNode | undefined;
}
export declare class ToolbarActionWrapper extends AbstractToolbarMenuWrapper implements TabBarToolbarItem {
    protected readonly toolbarItem: RenderedToolbarAction;
    constructor(effectiveMenuPath: MenuPath, commandRegistry: CommandRegistry, menuRegistry: MenuModelRegistry, contextKeyService: ContextKeyService, contextMenuRenderer: ContextMenuRenderer, toolbarItem: RenderedToolbarAction);
    isEnabled(widget?: Widget): boolean;
    protected executeCommand(widget: Widget, e: React.MouseEvent<HTMLElement>): void;
    isVisible(widget: Widget): boolean;
    group?: string | undefined;
    priority?: number | undefined;
    get id(): string;
    get icon(): string | undefined;
    get tooltip(): string | undefined;
    get text(): string | undefined;
    get onDidChange(): Event<void> | undefined;
    get menuPath(): MenuPath;
    get menuNode(): CompoundMenuNode | undefined;
    toMenuNode(): MenuNode | undefined;
}
export {};
//# sourceMappingURL=tab-bar-toolbar-menu-adapters.d.ts.map