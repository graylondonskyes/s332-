import { DefaultSecondaryWindowService } from '../../browser/window/default-secondary-window-service';
import { ApplicationShell, ExtractableWidget } from '../../browser';
import { ElectronWindowPreferences } from '../../electron-common/electron-window-preferences';
export declare class ElectronSecondaryWindowService extends DefaultSecondaryWindowService {
    protected readonly electronWindowPreferences: ElectronWindowPreferences;
    init(): void;
    protected updateWindowZoomLevel(zoomLevel: number): Promise<void>;
    focus(win: Window): void;
    registerShutdownListeners(): void;
    protected windowCreated(newWindow: Window, widget: ExtractableWidget, shell: ApplicationShell): void;
    private canClose;
}
//# sourceMappingURL=electron-secondary-window-service.d.ts.map