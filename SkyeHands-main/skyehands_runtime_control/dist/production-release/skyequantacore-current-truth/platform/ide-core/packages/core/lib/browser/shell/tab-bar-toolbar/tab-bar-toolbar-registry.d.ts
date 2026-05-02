import { CommandRegistry, ContributionProvider, Disposable, DisposableCollection, Emitter, Event, MenuModelRegistry, MenuPath } from '../../../common';
import { ContextKeyService } from '../../context-key-service';
import { FrontendApplicationContribution } from '../../frontend-application-contribution';
import { Widget } from '../../widgets';
import { ReactTabBarToolbarAction, RenderedToolbarAction } from './tab-bar-toolbar-types';
import { KeybindingRegistry } from '../../keybinding';
import { LabelParser } from '../../label-parser';
import { ContextMenuRenderer } from '../../context-menu-renderer';
import { TabBarToolbarItem } from './tab-toolbar-item';
/**
 * Clients should implement this interface if they want to contribute to the tab-bar toolbar.
 */
export declare const TabBarToolbarContribution: unique symbol;
/**
 * Representation of a tabbar toolbar contribution.
 */
export interface TabBarToolbarContribution {
    /**
     * Registers toolbar items.
     * @param registry the tabbar toolbar registry.
     */
    registerToolbarItems(registry: TabBarToolbarRegistry): void;
}
interface MenuDelegate {
    menuPath: MenuPath;
    isVisible(widget?: Widget): boolean;
}
/**
 * Main, shared registry for tab-bar toolbar items.
 */
export declare class TabBarToolbarRegistry implements FrontendApplicationContribution {
    protected items: Map<string, TabBarToolbarItem>;
    protected menuDelegates: Map<string, MenuDelegate>;
    protected readonly commandRegistry: CommandRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected readonly menuRegistry: MenuModelRegistry;
    protected readonly keybindingRegistry: KeybindingRegistry;
    protected readonly labelParser: LabelParser;
    protected readonly contextMenuRenderer: ContextMenuRenderer;
    protected readonly contributionProvider: ContributionProvider<TabBarToolbarContribution>;
    protected readonly onDidChangeEmitter: Emitter<void>;
    readonly onDidChange: Event<void>;
    protected fireOnDidChange: any;
    onStart(): void;
    /**
     * Registers the given item. Throws an error, if the corresponding command cannot be found or an item has been already registered for the desired command.
     *
     * @param item the item to register.
     */
    registerItem(item: RenderedToolbarAction | ReactTabBarToolbarAction): Disposable;
    doRegisterItem(item: TabBarToolbarItem): DisposableCollection;
    /**
     * Returns an array of tab-bar toolbar items which are visible when the `widget` argument is the current one.
     *
     * By default returns with all items where the command is enabled and `item.isVisible` is `true`.
     */
    visibleItems(widget: Widget): Array<TabBarToolbarItem>;
    unregisterItem(id: string): void;
    registerMenuDelegate(menuPath: MenuPath, when?: ((widget: Widget) => boolean)): Disposable;
    unregisterMenuDelegate(menuPath: MenuPath): void;
    /**
     * Generate a single ID string from a menu path that
     * is likely to be unique amongst the items in the toolbar.
     *
     * @param menuPath a menubar path
     * @returns a likely unique ID based on the path
     */
    toElementId(menuPath: MenuPath): string;
}
export {};
//# sourceMappingURL=tab-bar-toolbar-registry.d.ts.map