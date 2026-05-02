import { ContextMenuRenderer, ContextMenuAccess, FrontendApplicationContribution, Anchor } from '../../browser';
import { ElectronMainMenuFactory } from './electron-main-menu-factory';
import { ContextMenuContext } from '../../browser/menu/context-menu-context';
import { BrowserContextMenuRenderer } from '../../browser/menu/browser-context-menu-renderer';
import { MenuPath, MenuContribution, MenuModelRegistry, CompoundMenuNode } from '../../common/menu';
import { ContextKeyService, ContextMatcher } from '../../browser/context-key-service';
import { PreferenceService } from '../../common/preferences';
export declare class ElectronContextMenuAccess extends ContextMenuAccess {
    readonly menuHandle: Promise<number>;
    constructor(menuHandle: Promise<number>);
}
export declare namespace ElectronTextInputContextMenu {
    const MENU_PATH: MenuPath;
    const UNDO_REDO_EDIT_GROUP: string[];
    const EDIT_GROUP: string[];
    const SELECT_GROUP: string[];
}
export declare class ElectronTextInputContextMenuContribution implements FrontendApplicationContribution, MenuContribution {
    protected readonly contextMenuRenderer: ContextMenuRenderer;
    protected readonly contextKeyService: ContextKeyService;
    onStart(): void;
    registerMenus(registry: MenuModelRegistry): void;
}
export declare class ElectronContextMenuRenderer extends BrowserContextMenuRenderer {
    protected readonly context: ContextMenuContext;
    protected readonly preferenceService: PreferenceService;
    protected readonly electronMenuFactory: ElectronMainMenuFactory;
    protected useNativeStyle: boolean;
    constructor();
    protected init(): void;
    protected doInit(): Promise<void>;
    protected doRender(params: {
        menuPath: MenuPath;
        menu: CompoundMenuNode;
        anchor: Anchor;
        contextMatcher: ContextMatcher;
        args?: any;
        context?: HTMLElement;
        onHide?: () => void;
    }): ContextMenuAccess;
}
//# sourceMappingURL=electron-context-menu-renderer.d.ts.map