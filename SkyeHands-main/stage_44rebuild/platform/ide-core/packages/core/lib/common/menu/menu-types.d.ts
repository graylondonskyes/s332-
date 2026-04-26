import { Event } from '../event';
export declare const MAIN_MENU_BAR: MenuPath;
export type MenuPath = string[];
export declare const MANAGE_MENU: MenuPath;
export declare const ACCOUNTS_MENU: MenuPath;
export declare const ACCOUNTS_SUBMENU: string[];
export interface ContextExpressionMatcher<T> {
    match(whenExpression: string, context: T | undefined): boolean;
}
/**
 * @internal For most use cases, refer to {@link MenuAction} or {@link MenuNode}
 */
export interface MenuNode {
    /**
     * technical identifier.
     */
    readonly id: string;
    /**
     * Menu nodes are sorted in ascending order based on their `sortString`.
     */
    readonly sortString: string;
    readonly effectiveMenuPath?: string[];
    isVisible<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
    onDidChange?: Event<void>;
}
export interface Action {
    isEnabled(effectiveMenuPath: MenuPath, ...args: unknown[]): boolean;
    isToggled(effectiveMenuPath: MenuPath, ...args: unknown[]): boolean;
    run(effectiveMenuPath: MenuPath, ...args: unknown[]): Promise<void>;
}
export declare namespace Action {
    function is(node: object): node is Action;
}
export interface MenuAction {
    /**
     * The command to execute.
     */
    readonly commandId: string;
    /**
     * Menu entries are sorted in ascending order based on their `order` strings. If omitted the determined
     * label will be used instead.
     */
    readonly order?: string;
    readonly label?: string;
    /**
     * Icon classes for the menu node. If present, these will produce an icon to the left of the label in browser-style menus.
     */
    readonly icon?: string;
    readonly when?: string;
}
export declare namespace MenuAction {
    function is(obj: unknown): obj is MenuAction;
}
/**
 * Metadata for the visual presentation of a node.
 * @internal For most uses cases, refer to {@link MenuNode}, {@link CommandMenuNode}, or {@link CompoundMenuNode}
 */
export interface RenderedMenuNode extends MenuNode {
    /**
     * Optional label. Will be rendered as text of the menu item.
     */
    readonly label: string;
    /**
     * Icon classes for the menu node. If present, these will produce an icon to the left of the label in browser-style menus.
     */
    readonly icon?: string;
}
export declare namespace RenderedMenuNode {
    function is(node: unknown): node is RenderedMenuNode;
}
export type CommandMenu = MenuNode & RenderedMenuNode & Action;
export declare namespace CommandMenu {
    function is(node: MenuNode | undefined): node is CommandMenu;
}
export type Group = CompoundMenuNode;
export declare namespace Group {
    function is(obj: unknown): obj is Group;
}
export type Submenu = CompoundMenuNode & RenderedMenuNode;
export interface CompoundMenuNode extends MenuNode {
    children: MenuNode[];
    contextKeyOverlays?: Record<string, string>;
    /**
     * Whether the group or submenu contains any visible children
     *
     * @param effectiveMenuPath The menu path where visibility is checked
     * @param contextMatcher The context matcher to use
     * @param context the context to use
     * @param args the command arguments, if applicable
     */
    isEmpty<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
}
export declare namespace CompoundMenuNode {
    function is(node?: unknown): node is CompoundMenuNode;
    function sortChildren(m1: MenuNode, m2: MenuNode): number;
    /**
     * Indicates whether the given node is the special `navigation` menu.
     *
     * @param node the menu node to check.
     * @returns `true` when the given node is a {@link CompoundMenuNode} with id `navigation`,
     * `false` otherwise.
     */
    function isNavigationGroup(node: MenuNode): node is CompoundMenuNode;
}
export interface MutableCompoundMenuNode {
    addNode(...node: MenuNode[]): void;
    removeNode(node: MenuNode): void;
    getOrCreate(menuPath: MenuPath, pathIndex: number, endIndex: number): CompoundMenuNode & MutableCompoundMenuNode;
}
export declare namespace MutableCompoundMenuNode {
    function is(node: unknown): node is MutableCompoundMenuNode;
}
//# sourceMappingURL=menu-types.d.ts.map