import { MenuNode, CompoundMenuNode, MenuPath, PreferenceService } from '../../common';
import { BrowserMainMenuFactory } from '../../browser/menu/browser-menu-plugin';
import { ContextMatcher } from '../../browser/context-key-service';
import { MenuDto, MenuRole } from '../../electron-common/electron-api';
/**
 * Representation of possible electron menu options.
 */
export interface ElectronMenuOptions {
    /**
     * Controls whether to render disabled menu items.
     * Defaults to `true`.
     */
    readonly showDisabled?: boolean;
    /**
     * Controls whether to render disabled items as disabled
     * Defaults to `true`
     */
    readonly honorDisabled?: boolean;
    /**
     * A DOM context to use when evaluating any `when` clauses
     * of menu items registered for this item.
     */
    context?: HTMLElement;
    /**
     * A context key service to use when evaluating any `when` clauses.
     * If none is provided, the global context will be used.
     */
    contextKeyService?: ContextMatcher;
}
/**
 * Define the action of the menu item, when specified the `click` property will
 * be ignored. See [roles](https://www.electronjs.org/docs/api/menu-item#roles).
 */
export type ElectronMenuItemRole = ('undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'pasteAndMatchStyle' | 'delete' | 'selectAll' | 'reload' | 'forceReload' | 'toggleDevTools' | 'resetZoom' | 'zoomIn' | 'zoomOut' | 'togglefullscreen' | 'window' | 'minimize' | 'close' | 'help' | 'about' | 'services' | 'hide' | 'hideOthers' | 'unhide' | 'quit' | 'startSpeaking' | 'stopSpeaking' | 'zoom' | 'front' | 'appMenu' | 'fileMenu' | 'editMenu' | 'viewMenu' | 'recentDocuments' | 'toggleTabBar' | 'selectNextTab' | 'selectPreviousTab' | 'mergeAllWindows' | 'clearRecentDocuments' | 'moveTabToNewWindow' | 'windowMenu');
export declare class ElectronMainMenuFactory extends BrowserMainMenuFactory {
    protected menu?: MenuDto[];
    protected preferencesService: PreferenceService;
    setMenuBar: any;
    postConstruct(): void;
    doSetMenuBar(): void;
    createElectronMenuBar(): MenuDto[];
    createElectronContextMenu(menuPath: MenuPath, menu: CompoundMenuNode, contextMatcher: ContextMatcher, args?: any[], context?: HTMLElement, skipSingleRootNode?: boolean): MenuDto[];
    protected fillMenuTemplate(parentItems: MenuDto[], menuPath: MenuPath, menu: MenuNode, args: unknown[] | undefined, contextMatcher: ContextMatcher, options: ElectronMenuOptions, skipRoot: boolean): MenuDto[];
    protected undefinedOrMatch(contextKeyService: ContextMatcher, expression?: string, context?: HTMLElement): boolean;
    protected roleFor(id: string): MenuRole | undefined;
    protected createOSXMenu(): MenuDto;
}
//# sourceMappingURL=electron-main-menu-factory.d.ts.map