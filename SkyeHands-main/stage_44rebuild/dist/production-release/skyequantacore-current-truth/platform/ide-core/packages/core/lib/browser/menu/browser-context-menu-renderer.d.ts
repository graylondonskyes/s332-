import { Menu } from '../widgets';
import { Anchor, ContextMenuAccess, ContextMenuRenderer } from '../context-menu-renderer';
import { ContextMatcher } from '../context-key-service';
import { CompoundMenuNode, MenuPath } from '../../common';
export declare class BrowserContextMenuAccess extends ContextMenuAccess {
    readonly menu: Menu;
    constructor(menu: Menu);
}
export declare class BrowserContextMenuRenderer extends ContextMenuRenderer {
    private menuFactory;
    protected doRender(params: {
        menuPath: MenuPath;
        menu: CompoundMenuNode;
        anchor: Anchor;
        contextMatcher: ContextMatcher;
        args?: unknown[];
        context?: HTMLElement;
        onHide?: () => void;
    }): ContextMenuAccess;
}
//# sourceMappingURL=browser-context-menu-renderer.d.ts.map