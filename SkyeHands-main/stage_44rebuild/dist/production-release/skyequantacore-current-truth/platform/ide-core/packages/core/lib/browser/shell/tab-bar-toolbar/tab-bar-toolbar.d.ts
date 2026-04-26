import * as React from 'react';
import { ContextKeyService } from '../../context-key-service';
import { CommandRegistry, Disposable, DisposableCollection } from '../../../common';
import { Anchor, ContextMenuAccess, ContextMenuRenderer } from '../../context-menu-renderer';
import { LabelParser } from '../../label-parser';
import { ReactWidget, Widget } from '../../widgets';
import { TabBarToolbarRegistry } from './tab-bar-toolbar-registry';
import { KeybindingRegistry } from '../..//keybinding';
import { TabBarToolbarItem } from './tab-toolbar-item';
import { MenuModelRegistry } from '../../../common/menu';
/**
 * Factory for instantiating tab-bar toolbars.
 */
export declare const TabBarToolbarFactory: unique symbol;
export interface TabBarToolbarFactory {
    (): TabBarToolbar;
}
export declare function toAnchor(event: React.MouseEvent): Anchor;
/**
 * Tab-bar toolbar widget representing the active [tab-bar toolbar items](TabBarToolbarItem).
 */
export declare class TabBarToolbar extends ReactWidget {
    protected current: Widget | undefined;
    protected inline: Map<string, TabBarToolbarItem>;
    protected more: Map<string, TabBarToolbarItem>;
    protected contextKeyListener: Disposable | undefined;
    protected toDisposeOnUpdateItems: DisposableCollection;
    protected keybindingContextKeys: Set<string>;
    protected readonly commands: CommandRegistry;
    protected readonly labelParser: LabelParser;
    protected readonly menus: MenuModelRegistry;
    protected readonly contextMenuRenderer: ContextMenuRenderer;
    protected readonly toolbarRegistry: TabBarToolbarRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected readonly keybindings: KeybindingRegistry;
    constructor();
    protected init(): void;
    updateItems(items: Array<TabBarToolbarItem>, current: Widget | undefined): void;
    updateTarget(current?: Widget): void;
    protected readonly toDisposeOnSetCurrent: DisposableCollection;
    protected setCurrent(current: Widget | undefined): void;
    protected render(): React.ReactNode;
    protected renderMore(): React.ReactNode;
    protected showMoreContextMenu: (event: React.MouseEvent) => void;
    renderMoreContextMenu(anchor: Anchor): ContextMenuAccess;
    shouldHandleMouseEvent(event: MouseEvent): boolean;
    protected commandIsEnabled(command: string): boolean;
    protected commandIsToggled(command: string): boolean;
    protected evaluateWhenClause(whenClause: string | undefined): boolean;
    protected maybeUpdate(): void;
}
export declare namespace TabBarToolbar {
    namespace Styles {
        const TAB_BAR_TOOLBAR = "lm-TabBar-toolbar";
        const TAB_BAR_TOOLBAR_ITEM = "item";
    }
}
//# sourceMappingURL=tab-bar-toolbar.d.ts.map