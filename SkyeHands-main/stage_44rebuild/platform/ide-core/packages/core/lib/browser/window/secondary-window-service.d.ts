import { Event } from '../../common';
import { ApplicationShell } from '../shell';
import { TheiaDockPanel } from '../shell/theia-dock-panel';
import { ExtractableWidget, TabBar, Widget } from '../widgets';
export declare abstract class SecondaryWindowRootWidget extends Widget {
    secondaryWindow: Window | SecondaryWindow;
    defaultRestoreArea?: ApplicationShell.Area;
    abstract widgets: ReadonlyArray<Widget>;
    abstract addWidget(widget: Widget, disposeCallback: () => void, options?: TheiaDockPanel.AddOptions): void;
    getTabBar?(widget: Widget): TabBar<Widget> | undefined;
}
export interface SecondaryWindow extends Window {
    rootWidget: SecondaryWindowRootWidget | undefined;
}
export declare function isSecondaryWindow(window: unknown): window is SecondaryWindow;
export declare const SecondaryWindowService: unique symbol;
/**
 * Service for opening new secondary windows to contain widgets extracted from the application shell.
 *
 * @experimental The functionality provided by this service and its implementation is still under development. Use with caution.
 */
export interface SecondaryWindowService {
    /**
     * Creates a new secondary window for a widget to be extracted from the application shell.
     * The created window is closed automatically when the current theia instance is closed.
     *
     * @param onClose optional callback that is invoked when the secondary window is closed
     * @returns the created window or `undefined` if it could not be created
     */
    createSecondaryWindow(widget: ExtractableWidget, shell: ApplicationShell): SecondaryWindow | Window | undefined;
    readonly onWindowOpened: Event<Window>;
    readonly onWindowClosed: Event<Window>;
    readonly beforeWidgetRestore: Event<[Widget, Window]>;
    /** Handles focussing the given secondary window in the browser and on Electron. */
    focus(win: Window): void;
    getWindows(): Window[];
}
//# sourceMappingURL=secondary-window-service.d.ts.map