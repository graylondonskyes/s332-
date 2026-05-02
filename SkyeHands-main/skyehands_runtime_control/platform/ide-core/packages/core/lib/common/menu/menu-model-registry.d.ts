import { CommandMenu, CompoundMenuNode, Group, MenuAction, MenuNode, MenuPath, MutableCompoundMenuNode, Submenu } from './menu-types';
import { Event } from 'vscode-languageserver-protocol';
import { ContributionProvider } from '../contribution-provider';
import { Command, CommandRegistry } from '../command';
import { Emitter } from '../event';
import { Disposable } from '../disposable';
export declare const MenuContribution: unique symbol;
/**
 * Representation of a menu contribution.
 *
 * Note that there are also convenience classes which combine multiple contributions into one.
 * For example to register a view together with a menu and keybinding you could use
 * {@link AbstractViewContribution} instead.
 *
 * ### Example usage
 *
 * ```ts
 * import { MenuContribution, MenuModelRegistry, MAIN_MENU_BAR } from '@theia/core';
 *
 * @injectable()
 * export class NewMenuContribution implements MenuContribution {
 *    registerMenus(menus: MenuModelRegistry): void {
 *         const menuPath = [...MAIN_MENU_BAR, '99_mymenu'];
 *         menus.registerSubmenu(menuPath, 'My Menu');
 *
 *         menus.registerMenuAction(menuPath, {
 *            commandId: MyCommand.id,
 *            label: 'My Action'
 *         });
 *     }
 * }
 * ```
 */
export interface MenuContribution {
    /**
     * Registers menus.
     * @param menus the menu model registry.
     */
    registerMenus(menus: MenuModelRegistry): void;
}
export declare enum ChangeKind {
    ADDED = 0,
    REMOVED = 1,
    CHANGED = 2,
    LINKED = 3
}
export interface MenuChangedEvent {
    kind: ChangeKind;
    path: MenuPath;
}
export interface StructuralMenuChange extends MenuChangedEvent {
    kind: ChangeKind.ADDED | ChangeKind.REMOVED | ChangeKind.LINKED;
    affectedChildId: string;
}
export declare namespace StructuralMenuChange {
    function is(evt: MenuChangedEvent): evt is StructuralMenuChange;
}
export declare const MenuNodeFactory: unique symbol;
export interface MenuNodeFactory {
    createGroup(id: string, orderString?: string, when?: string): Group & MutableCompoundMenuNode;
    createCommandMenu(item: MenuAction): CommandMenu;
    createSubmenu(id: string, label: string, contextKeyOverlays: Record<string, string> | undefined, orderString?: string, icon?: string, when?: string): Submenu & MutableCompoundMenuNode;
    createSubmenuLink(delegate: Submenu, sortString?: string, when?: string): MenuNode;
}
/**
 * The MenuModelRegistry allows to register and unregister menus, submenus and actions
 * via strings and {@link MenuAction}s without the need to access the underlying UI
 * representation.
 */
export declare class MenuModelRegistry {
    protected readonly contributions: ContributionProvider<MenuContribution>;
    protected readonly commands: CommandRegistry;
    protected readonly menuNodeFactory: MenuNodeFactory;
    protected root: Group & MutableCompoundMenuNode;
    protected readonly onDidChangeEmitter: Emitter<MenuChangedEvent>;
    constructor(contributions: ContributionProvider<MenuContribution>, commands: CommandRegistry, menuNodeFactory: MenuNodeFactory);
    get onDidChange(): Event<MenuChangedEvent>;
    protected isReady: boolean;
    onStart(): void;
    /**
     * Adds the given menu action to the menu denoted by the given path.
     *
     * @returns a disposable which, when called, will remove the menu action again.
     */
    registerCommandMenu(menuPath: MenuPath, item: CommandMenu): Disposable;
    /**
     * Adds the given menu action to the menu denoted by the given path.
     *
     * @returns a disposable which, when called, will remove the menu action again.
     */
    registerMenuAction(menuPath: MenuPath, item: MenuAction): Disposable;
    /**
     * Register a new menu at the given path with the given label.
     * (If the menu already exists without a label, iconClass or order this method can be used to set them.)
     *
     * @param menuPath the path for which a new submenu shall be registered.
     * @param label the label to be used for the new submenu.
     * @param options optionally allows to set an icon class and specify the order of the new menu.
     *
     * @returns if the menu was successfully created a disposable will be returned which,
     * when called, will remove the menu again. If the menu already existed a no-op disposable
     * will be returned.
     *
     * Note that if the menu already existed and was registered with a different label an error
     * will be thrown.
     */
    registerSubmenu(menuPath: MenuPath, label: string, options?: {
        sortString?: string;
        icon?: string;
        when?: string;
        contextKeyOverlay?: Record<string, string>;
    }): Disposable;
    linkCompoundMenuNode(params: {
        newParentPath: MenuPath;
        submenuPath: MenuPath;
        order?: string;
        when?: string;
    }): Disposable;
    /**
     * Unregister all menu nodes with the same id as the given menu action.
     *
     * @param item the item whose id will be used.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(item: MenuAction, menuPath?: MenuPath): void;
    /**
     * Unregister all menu nodes with the same id as the given command.
     *
     * @param command the command whose id will be used.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(command: Command, menuPath?: MenuPath): void;
    /**
     * Unregister all menu nodes with the given id.
     *
     * @param id the id which shall be removed.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(id: string, menuPath?: MenuPath): void;
    protected removeActionInSubtree(parent: MenuNode, id: string): void;
    protected findInNode(root: MenuNode, menuPath: MenuPath, pathIndex: number): MenuNode | undefined;
    getMenuNode(menuPath: string[]): MenuNode | undefined;
    getMenu(menuPath: MenuPath): CompoundMenuNode | undefined;
    static removeSingleRootNodes(fullMenuModel: CompoundMenuNode): CompoundMenuNode;
    /**
     * Checks the given menu model whether it will show a menu with a single submenu.
     *
     * @param fullMenuModel the menu model to analyze
     * @param menuPath the menu's path
     * @returns if the menu will show a single submenu this returns a menu that will show the child elements of the submenu,
     * otherwise the given `fullMenuModel` is return
     */
    static removeSingleRootNode(fullMenuModel: CompoundMenuNode): CompoundMenuNode;
    static isEmpty(node: MenuNode): boolean;
    protected fireChangeEvent<T extends MenuChangedEvent>(evt: T): void;
}
//# sourceMappingURL=menu-model-registry.d.ts.map