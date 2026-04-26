import { CompoundMenuNode, ContextExpressionMatcher, Group, MenuNode, MenuPath, Submenu } from '../../common/menu/menu-types';
import { Event } from '../../common';
export declare class SubMenuLink implements CompoundMenuNode {
    private readonly delegate;
    private readonly _sortString?;
    private readonly _when?;
    constructor(delegate: Submenu, _sortString?: string | undefined, _when?: string | undefined);
    get id(): string;
    get onDidChange(): Event<void> | undefined;
    get children(): MenuNode[];
    get contextKeyOverlays(): Record<string, string> | undefined;
    get label(): string;
    get icon(): string | undefined;
    get sortString(): string;
    isVisible<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
    isEmpty<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
}
/**
 * Node representing a (sub)menu in the menu tree structure.
 */
export declare abstract class AbstractCompoundMenuImpl implements MenuNode {
    readonly id: string;
    protected readonly orderString?: string | undefined;
    protected readonly when?: string | undefined;
    readonly children: MenuNode[];
    protected constructor(id: string, orderString?: string | undefined, when?: string | undefined);
    getOrCreate(menuPath: MenuPath, pathIndex: number, endIndex: number): CompoundMenuImpl;
    /**
     * Menu nodes are sorted in ascending order based on their `sortString`.
     */
    isVisible<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
    isEmpty<T>(effectiveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
    addNode(...node: MenuNode[]): void;
    getNode(id: string): MenuNode | undefined;
    removeById(id: string): void;
    removeNode(node: MenuNode): void;
    get sortString(): string;
}
export declare class GroupImpl extends AbstractCompoundMenuImpl implements Group {
    constructor(id: string, orderString?: string, when?: string);
}
export declare class SubmenuImpl extends AbstractCompoundMenuImpl implements Submenu {
    readonly label: string;
    readonly contextKeyOverlays: Record<string, string> | undefined;
    readonly icon?: string | undefined;
    constructor(id: string, label: string, contextKeyOverlays: Record<string, string> | undefined, orderString?: string, icon?: string | undefined, when?: string);
}
export type CompoundMenuImpl = SubmenuImpl | GroupImpl;
//# sourceMappingURL=composite-menu-node.d.ts.map