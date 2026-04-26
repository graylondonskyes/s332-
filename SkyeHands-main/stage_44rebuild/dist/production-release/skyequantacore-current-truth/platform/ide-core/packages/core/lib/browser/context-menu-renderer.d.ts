import { CompoundMenuNode, MenuModelRegistry, MenuPath } from '../common/menu';
import { Disposable, DisposableCollection } from '../common/disposable';
import { ContextKeyService, ContextMatcher } from './context-key-service';
export interface Coordinate {
    x: number;
    y: number;
}
export declare const Coordinate: unique symbol;
export type Anchor = MouseEvent | Coordinate;
export declare function coordinateFromAnchor(anchor: Anchor): Coordinate;
export declare class ContextMenuAccess implements Disposable {
    protected readonly toDispose: DisposableCollection;
    readonly onDispose: import("../common").Event<void>;
    constructor(toClose: Disposable);
    get disposed(): boolean;
    dispose(): void;
}
export declare abstract class ContextMenuRenderer {
    menuRegistry: MenuModelRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected _current: ContextMenuAccess | undefined;
    protected readonly toDisposeOnSetCurrent: DisposableCollection;
    /**
     * Currently opened context menu.
     * Rendering a new context menu will close the current.
     */
    get current(): ContextMenuAccess | undefined;
    set current(current: ContextMenuAccess | undefined);
    protected setCurrent(current: ContextMenuAccess | undefined): void;
    render(options: RenderContextMenuOptions): ContextMenuAccess;
    protected abstract doRender(params: {
        menuPath: MenuPath;
        menu: CompoundMenuNode;
        anchor: Anchor;
        contextMatcher: ContextMatcher;
        args?: any[];
        context?: HTMLElement;
        onHide?: () => void;
    }): ContextMenuAccess;
    protected resolve(options: RenderContextMenuOptions): RenderContextMenuOptions;
}
export interface RenderContextMenuOptions {
    menu?: CompoundMenuNode;
    menuPath: MenuPath;
    anchor: Anchor;
    args?: any[];
    /**
     * Whether the anchor should be passed as an argument to the handlers of commands for this context menu.
     * If true, the anchor will be appended to the list of arguments or passed as the only argument if no other
     * arguments are supplied.
     * Default is `true`.
     */
    includeAnchorArg?: boolean;
    /**
     * A DOM context for the menu to be shown
     * Will be used to attach the menu to a window and to evaluate enablement ("when"-clauses)
     */
    context: HTMLElement;
    contextKeyService?: ContextMatcher;
    onHide?: () => void;
    /**
     * If true a single submenu in the context menu is not rendered but its children are rendered on the top level.
     * Default is `false`.
     */
    skipSingleRootNode?: boolean;
}
//# sourceMappingURL=context-menu-renderer.d.ts.map