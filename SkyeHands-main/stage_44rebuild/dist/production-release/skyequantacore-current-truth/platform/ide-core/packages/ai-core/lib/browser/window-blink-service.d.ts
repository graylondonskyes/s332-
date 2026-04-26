import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { SecondaryWindowService } from '@theia/core/lib/browser/window/secondary-window-service';
/**
 * Result of a window blink attempt
 */
export interface WindowBlinkResult {
    /** Whether the window blink was successful */
    success: boolean;
    /** Error message if the blink failed */
    error?: string;
}
/**
 * Service for blinking/flashing the application window to get user attention.
 */
export declare class WindowBlinkService {
    protected readonly windowTitleService?: WindowTitleService;
    protected readonly secondaryWindowService?: SecondaryWindowService;
    private isElectron;
    private activeBlinkInterval?;
    private originalSecondaryTitles;
    constructor();
    /**
     * Blink/flash the window to get user attention.
     * The implementation varies depending on the platform and environment.
     *
     * @param agentName Optional name of the agent to include in the blink notification
     */
    blinkWindow(agentName?: string): Promise<WindowBlinkResult>;
    private blinkElectronWindow;
    private blinkBrowserWindow;
    private blinkDocumentTitle;
    /**
     * Set the window title directly on document.title and the custom titlebar element.
     * This bypasses WindowTitleService to avoid corrupting the title template state.
     */
    private setTitle;
    /**
     * Set the alert title on all secondary windows, or restore their original titles.
     */
    private setSecondaryWindowTitles;
    /**
     * Restore original titles on all secondary windows.
     */
    private restoreSecondaryWindowTitles;
    private blinkWithVisibilityAPI;
    private focusWindow;
}
//# sourceMappingURL=window-blink-service.d.ts.map