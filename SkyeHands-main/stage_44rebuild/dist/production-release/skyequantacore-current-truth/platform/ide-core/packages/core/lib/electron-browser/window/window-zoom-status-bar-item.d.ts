import { FrontendApplicationContribution, KeybindingRegistry, StatusBar } from '../../browser';
import { CommandRegistry, PreferenceService } from '../../common';
export declare class WindowZoomStatusBarItem implements FrontendApplicationContribution {
    static readonly ID = "window-zoom-status";
    protected readonly statusBar: StatusBar;
    protected readonly preferenceService: PreferenceService;
    protected readonly commandRegistry: CommandRegistry;
    protected readonly keybindingRegistry: KeybindingRegistry;
    onStart(): void;
    protected updateZoomStatusBarItem(): void;
    protected getZoomLevel(): number;
    protected createTooltip(zoomLevel: number): HTMLElement;
}
//# sourceMappingURL=window-zoom-status-bar-item.d.ts.map