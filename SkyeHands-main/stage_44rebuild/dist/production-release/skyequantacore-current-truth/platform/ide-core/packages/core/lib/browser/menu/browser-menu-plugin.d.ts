import { MenuBar, Menu as MenuWidget, Widget } from '@lumino/widgets';
import { CommandRegistry as LuminoCommandRegistry } from '@lumino/commands';
import { PreferenceService } from '../../common';
import { KeybindingRegistry } from '../keybinding';
import { FrontendApplication } from '../frontend-application';
import { FrontendApplicationContribution } from '../frontend-application-contribution';
import { ContextKeyService, ContextMatcher } from '../context-key-service';
import { ContextMenuContext } from './context-menu-context';
import { Message } from '../widgets';
import { ApplicationShell } from '../shell';
import { CorePreferences } from '../../common/core-preferences';
import { CompoundMenuNode, MenuNode, MenuPath, Submenu } from '../../common/menu/menu-types';
import { MenuModelRegistry } from '../../common/menu/menu-model-registry';
export declare abstract class MenuBarWidget extends MenuBar {
    abstract activateMenu(label: string, ...labels: string[]): Promise<MenuWidget>;
    abstract triggerMenuItem(label: string, ...labels: string[]): Promise<MenuWidget.IItem>;
}
export interface BrowserMenuOptions extends MenuWidget.IOptions {
    context?: HTMLElement;
}
export declare class BrowserMainMenuFactory implements MenuWidgetFactory {
    protected readonly contextKeyService: ContextKeyService;
    protected readonly context: ContextMenuContext;
    protected readonly corePreferences: CorePreferences;
    protected readonly keybindingRegistry: KeybindingRegistry;
    protected readonly menuProvider: MenuModelRegistry;
    createMenuBar(): MenuBarWidget;
    protected getMenuBarVisibility(): string;
    protected showMenuBar(menuBar: DynamicMenuBarWidget, preference?: string): void;
    protected fillMenuBar(menuBar: MenuBarWidget): void;
    createContextMenu(effectiveMenuPath: MenuPath, menuModel: CompoundMenuNode, contextMatcher: ContextMatcher, args?: unknown[], context?: HTMLElement): MenuWidget;
    createMenuWidget(parentPath: MenuPath, menu: CompoundMenuNode, contextMatcher: ContextMatcher, options: BrowserMenuOptions, args?: unknown[]): DynamicMenuWidget;
    protected get services(): MenuServices;
}
export declare function isMenuElement(element: HTMLElement | null): boolean;
export declare class DynamicMenuBarWidget extends MenuBarWidget {
    /**
     * We want to restore the focus after the menu closes.
     */
    protected previousFocusedElement: HTMLElement | undefined;
    constructor();
    activateMenu(label: string, ...labels: string[]): Promise<MenuWidget>;
    triggerMenuItem(label: string, ...labels: string[]): Promise<MenuWidget.IItem>;
}
export declare class MenuServices {
    readonly contextKeyService: ContextKeyService;
    readonly context: ContextMenuContext;
    readonly menuWidgetFactory: MenuWidgetFactory;
}
export interface MenuWidgetFactory {
    createMenuWidget(effectiveMenuPath: MenuPath, menu: Submenu, contextMatcher: ContextMatcher, options: BrowserMenuOptions, args?: unknown[]): MenuWidget;
}
/**
 * A menu widget that would recompute its items on update.
 */
export declare class DynamicMenuWidget extends MenuWidget {
    protected readonly effectiveMenuPath: MenuPath;
    protected menu: CompoundMenuNode;
    protected options: BrowserMenuOptions;
    protected contextMatcher: ContextMatcher;
    protected services: MenuServices;
    protected args?: unknown[] | undefined;
    private static nextCommmandId;
    /**
     * We want to restore the focus after the menu closes.
     */
    protected previousFocusedElement: HTMLElement | undefined;
    constructor(effectiveMenuPath: MenuPath, menu: CompoundMenuNode, options: BrowserMenuOptions, contextMatcher: ContextMatcher, services: MenuServices, args?: unknown[] | undefined);
    protected onAfterAttach(msg: Message): void;
    protected onBeforeDetach(msg: Message): void;
    handleEvent(event: Event): void;
    handlePointerDown(event: PointerEvent): void;
    private hitTestMenus;
    aboutToShow({ previousFocusedElement }: {
        previousFocusedElement: HTMLElement | undefined;
    }): void;
    open(x: number, y: number, options?: MenuWidget.IOpenOptions): void;
    protected updateSubMenus(parentPath: MenuPath, parent: MenuWidget, menu: CompoundMenuNode, commands: LuminoCommandRegistry, contextMatcher: ContextMatcher, context?: HTMLElement | undefined): void;
    protected createItems(parentPath: MenuPath, nodes: MenuNode[], phCommandRegistry: LuminoCommandRegistry, contextMatcher: ContextMatcher, context?: HTMLElement): MenuWidget.IItemOptions[];
    protected preserveFocusedElement(previousFocusedElement?: Element | null): boolean;
    protected restoreFocusedElement(): boolean;
    protected runWithPreservedFocusContext(what: () => void): void;
}
export declare class BrowserMenuBarContribution implements FrontendApplicationContribution {
    protected readonly factory: BrowserMainMenuFactory;
    protected readonly shell: ApplicationShell;
    protected readonly preferenceService: PreferenceService;
    constructor(factory: BrowserMainMenuFactory);
    onStart(app: FrontendApplication): void;
    get menuBar(): MenuBarWidget | undefined;
    protected appendMenu(shell: ApplicationShell): void;
    protected createLogo(): Widget;
}
//# sourceMappingURL=browser-menu-plugin.d.ts.map