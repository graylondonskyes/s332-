import { ExtractableWidget, TabBar, Widget } from './widgets';
import { MessageService } from '../common/message-service';
import { ApplicationShell, DockPanelRenderer } from './shell/application-shell';
import { Emitter } from '../common/event';
import { SecondaryWindowRootWidget, SecondaryWindowService } from './window/secondary-window-service';
import { KeybindingRegistry } from './keybinding';
import { TheiaDockPanel } from './shell/theia-dock-panel';
/**
 * Offers functionality to move a widget out of the main window to a newly created window.
 * Widgets must explicitly implement the `ExtractableWidget` interface to support this.
 *
 * This handler manages the opened secondary windows and sets up messaging between them and the Theia main window.
 * In addition, it provides access to the extracted widgets and provides notifications when widgets are added to or removed from this handler.
 *
 */
export declare class SecondaryWindowHandler {
    /** List of widgets in secondary windows. */
    protected readonly _widgets: Widget[];
    protected applicationShell: ApplicationShell;
    protected dockPanelRendererFactory: (document?: Document | ShadowRoot) => DockPanelRenderer;
    protected keybindings: KeybindingRegistry;
    protected dockPanelFactory: TheiaDockPanel.Factory;
    protected readonly onWillAddWidgetEmitter: Emitter<[Widget, Window]>;
    /** Subscribe to get notified when a widget is added to this handler, i.e. the widget was moved to an secondary window . */
    readonly onWillAddWidget: import("../common/event").Event<[Widget, Window]>;
    protected readonly onDidAddWidgetEmitter: Emitter<[Widget, Window]>;
    /** Subscribe to get notified when a widget is added to this handler, i.e. the widget was moved to an secondary window . */
    readonly onDidAddWidget: import("../common/event").Event<[Widget, Window]>;
    protected readonly onWillRemoveWidgetEmitter: Emitter<[Widget, Window]>;
    /** Subscribe to get notified when a widget is removed from this handler, i.e. the widget's window was closed or the widget was disposed. */
    readonly onWillRemoveWidget: import("../common/event").Event<[Widget, Window]>;
    protected readonly onDidRemoveWidgetEmitter: Emitter<[Widget, Window]>;
    /** Subscribe to get notified when a widget is removed from this handler, i.e. the widget's window was closed or the widget was disposed. */
    readonly onDidRemoveWidget: import("../common/event").Event<[Widget, Window]>;
    protected readonly messageService: MessageService;
    protected readonly secondaryWindowService: SecondaryWindowService;
    /** @returns List of widgets in secondary windows. */
    get widgets(): ReadonlyArray<Widget>;
    /**
     * Sets up message forwarding from the main window to secondary windows.
     * Does nothing if this service has already been initialized.
     *
     * @param shell The `ApplicationShell` that widgets will be moved out from.
     * @param dockPanelRendererFactory A factory function to create a `DockPanelRenderer` for use in secondary windows.
     */
    init(shell: ApplicationShell, dockPanelRendererFactory: (document?: Document | ShadowRoot) => DockPanelRenderer): void;
    /**
     *  Moves the given widget to a new window.
     *
     * @param widget the widget to extract
     */
    moveWidgetToSecondaryWindow(widget: ExtractableWidget): void;
    protected setupHtmlLanguageAttributes(element: HTMLElement): void;
    private onWidgetRemove;
    addWidgetToSecondaryWindow(widget: Widget, secondaryWindow: Window, options?: TheiaDockPanel.AddOptions): void;
    onTabCloseRequested(_sender: TabBar<Widget>, _args: TabBar.ITabCloseRequestedArgs<Widget>): boolean;
    /**
     * If the given widget is tracked by this handler, activate it and focus its secondary window.
     *
     * @param widgetId The widget to activate specified by its id
     * @returns The activated `ExtractableWidget` or `undefined` if the given widget id is unknown to this handler.
     */
    activateWidget(widgetId: string): ExtractableWidget | Widget | undefined;
    /**
     * If the given widget is tracked by this handler, reveal it by focussing its secondary window.
     *
     * @param widgetId The widget to reveal specified by its id
     * @returns The revealed `ExtractableWidget` or `undefined` if the given widget id is unknown to this handler.
     */
    revealWidget(widgetId: string): ExtractableWidget | Widget | undefined;
    getFocusedWindow(): Window | undefined;
    protected addWidget(widget: Widget, win: Window): void;
    protected removeWidget(widget: Widget, win: Window): void;
    getTabBarFor(widget: Widget): TabBar<Widget> | undefined;
}
export declare function getDefaultRestoreArea(window: Window): ApplicationShell.Area | undefined;
export declare function getAllWidgetsFromSecondaryWindow(window: Window): ReadonlyArray<Widget> | undefined;
export declare function extractSecondaryWindowRootWidget(widget: Widget | undefined | null): SecondaryWindowRootWidget | undefined;
export declare function extractSecondaryWindow(widget: Widget | undefined | null): Window | undefined;
//# sourceMappingURL=secondary-window-handler.d.ts.map