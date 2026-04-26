import { SecondaryWindow, SecondaryWindowService } from './secondary-window-service';
import { WindowService } from './window-service';
import { ExtractableWidget, Widget } from '../widgets';
import { ApplicationShell } from '../shell';
import { Emitter, Event, PreferenceService } from '../../common';
import { SaveableService } from '../saveable-service';
export declare class DefaultSecondaryWindowService implements SecondaryWindowService {
    protected readonly onWindowOpenedEmitter: Emitter<Window>;
    readonly onWindowOpened: Event<Window>;
    protected readonly onWindowClosedEmitter: Emitter<Window>;
    readonly onWindowClosed: Event<Window>;
    protected readonly beforeWidgetRestoreEmitter: Emitter<[Widget, Window]>;
    readonly beforeWidgetRestore: Event<[Widget, Window]>;
    protected static SECONDARY_WINDOW_URL: string;
    /**
     * Randomized prefix to be included in opened windows' ids.
     * This avoids conflicts when creating sub-windows from multiple theia instances (e.g. by opening Theia multiple times in the same browser)
     */
    protected readonly prefix: number;
    /** Unique id. Increase after every access. */
    private nextId;
    protected secondaryWindows: Window[];
    protected readonly windowService: WindowService;
    protected readonly preferenceService: PreferenceService;
    protected readonly saveResourceService: SaveableService;
    init(): void;
    protected registerShutdownListeners(): void;
    createSecondaryWindow(widget: ExtractableWidget, shell: ApplicationShell): Window | SecondaryWindow | undefined;
    protected windowCreated(newWindow: Window, widget: ExtractableWidget, shell: ApplicationShell): void;
    protected findWindow<T>(windowName: string): Window | undefined;
    protected findSecondaryWindowCoordinates(widget: ExtractableWidget): (number | undefined)[];
    getWindows(): Window[];
    focus(win: Window): void;
    protected nextWindowId(): string;
    /**
     * Restore the widgets back to the main window. SecondaryWindowHandler needs to get informated about this.
     */
    protected restoreWidgets(newWindow: Window, extractableWidget: ExtractableWidget, shell: ApplicationShell): Promise<boolean>;
}
//# sourceMappingURL=default-secondary-window-service.d.ts.map