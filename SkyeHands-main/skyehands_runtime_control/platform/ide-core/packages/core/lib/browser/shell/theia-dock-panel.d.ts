import { TabBar, Widget, DockPanel, Title } from '@lumino/widgets';
import { DisposableCollection } from '../../common/disposable';
import { CorePreferences } from '../../common/core-preferences';
import { Emitter, Event } from '../../common';
export declare const ACTIVE_TABBAR_CLASS = "theia-tabBar-active";
export declare const MAIN_AREA_ID = "theia-main-content-panel";
export declare const BOTTOM_AREA_ID = "theia-bottom-content-panel";
/**
 * This specialization of DockPanel adds various events that are used for implementing the
 * side panels of the application shell.
 */
export declare class TheiaDockPanel extends DockPanel {
    protected readonly preferences?: CorePreferences | undefined;
    protected readonly maximizeCallback?: ((area: TheiaDockPanel) => void) | undefined;
    /**
     * Emitted when a widget is added to the panel.
     */
    readonly widgetAdded: any;
    /**
     * Emitted when a widget is activated by calling `activateWidget`.
     */
    readonly widgetActivated: any;
    /**
     * Emitted when a widget is removed from the panel.
     */
    readonly widgetRemoved: any;
    protected readonly onDidChangeCurrentEmitter: Emitter<any>;
    protected disableDND: boolean | undefined;
    protected tabWithDNDDisabledStyling?: HTMLElement;
    get onDidChangeCurrent(): Event<Title<Widget> | undefined>;
    constructor(options?: DockPanel.IOptions, preferences?: CorePreferences | undefined, maximizeCallback?: ((area: TheiaDockPanel) => void) | undefined);
    protected onTabDetachRequestedWithDisabledDND(sender: TabBar<Widget>, args: TabBar.ITabDetachRequestedArgs<Widget>): void;
    protected onNullTabDragDataWithDisabledDND(): void;
    handleEvent(event: globalThis.Event): void;
    toggleMaximized(): void;
    isElectron(): boolean;
    protected _currentTitle: Title<Widget> | undefined;
    get currentTitle(): Title<Widget> | undefined;
    get currentTabBar(): TabBar<Widget> | undefined;
    findTabBar(title: Title<Widget>): TabBar<Widget> | undefined;
    protected readonly toDisposeOnMarkAsCurrent: DisposableCollection;
    markAsCurrent(title: Title<Widget> | undefined): void;
    markActiveTabBar(title?: Title<Widget>): void;
    addWidget(widget: Widget, options?: TheiaDockPanel.AddOptions): void;
    activateWidget(widget: Widget): void;
    protected onChildRemoved(msg: Widget.ChildMessage): void;
    nextTabBarWidget(widget: Widget): Widget | undefined;
    nextTabBarInPanel(tabBar: TabBar<Widget>): TabBar<Widget> | undefined;
    previousTabBarWidget(widget: Widget): Widget | undefined;
    previousTabBarInPanel(tabBar: TabBar<Widget>): TabBar<Widget> | undefined;
    dispose(): void;
}
export declare namespace TheiaDockPanel {
    const Factory: unique symbol;
    interface Factory {
        (options?: DockPanel.IOptions | TheiaDockPanel.IOptions, maximizeCallback?: (area: TheiaDockPanel) => void): TheiaDockPanel;
    }
    interface IOptions extends DockPanel.IOptions {
        /** whether drag and drop for tabs should be disabled */
        disableDragAndDrop?: boolean;
        /**
         * @param sender the tab bar
         * @param args the widget (title)
         * @returns true if the request was handled by this handler, false if the tabbar should handle the request
         */
        closeHandler?: (sender: TabBar<Widget>, args: TabBar.ITabCloseRequestedArgs<Widget>) => boolean;
    }
    function isTheiaDockPanelIOptions(options: DockPanel.IOptions | undefined): options is IOptions;
    interface AddOptions extends DockPanel.IAddOptions {
        /**
         * Whether to also close the widget referenced by `ref`.
         */
        closeRef?: boolean;
    }
}
//# sourceMappingURL=theia-dock-panel.d.ts.map