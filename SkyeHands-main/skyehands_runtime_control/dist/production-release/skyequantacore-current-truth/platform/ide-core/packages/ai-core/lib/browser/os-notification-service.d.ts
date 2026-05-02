/**
 * Configuration options for OS notifications
 */
export interface OSNotificationOptions {
    /** The notification body text */
    body?: string;
    /** Icon to display with the notification */
    icon?: string;
    /** Whether the notification should be silent */
    silent?: boolean;
    /** Tag to group notifications */
    tag?: string;
    /** Whether the notification requires user interaction to dismiss */
    requireInteraction?: boolean;
    /** Custom data to associate with the notification */
    data?: unknown;
}
/**
 * Result of an OS notification attempt
 */
export interface OSNotificationResult {
    /** Whether the notification was successfully shown */
    success: boolean;
    /** Error message if the notification failed */
    error?: string;
    /** The created notification instance (if successful) */
    notification?: Notification;
}
/**
 * Service to handle OS-level notifications across different platforms
 * Provides fallback mechanisms for environments where notifications are unavailable
 */
export declare class OSNotificationService {
    private isElectron;
    constructor();
    /**
     * Show an OS-level notification with the given title and options
     *
     * @param title The notification title
     * @param options Optional notification configuration
     * @returns Promise resolving to the notification result
     */
    showNotification(title: string, options?: OSNotificationOptions, onClickCallback?: () => void): Promise<OSNotificationResult>;
    /**
     * Check if notification permission is granted
     *
     * @returns The current notification permission state
     */
    getPermissionStatus(): NotificationPermission;
    /**
     * Request notification permission from the user
     *
     * @returns Promise resolving to the permission state
     */
    requestPermission(): Promise<NotificationPermission>;
    /**
     * Check if OS notifications are supported in the current environment
     *
     * @returns true if notifications are supported, false otherwise
     */
    isNotificationSupported(): boolean;
    /**
     * Show a notification specifically for agent completion
     * This is a convenience method with pre-configured options for agent notifications
     *
     * @param agentName The name of the agent that completed
     * @param sessionTitle Optional title of the chat session for identification
     * @param onClickCallback Optional callback to invoke when the notification is clicked
     * @returns Promise resolving to the notification result
     */
    showAgentCompletionNotification(agentName: string, sessionTitle?: string, onClickCallback?: () => void): Promise<OSNotificationResult>;
    /**
     * Ensure notification permission is granted
     *
     * @returns Promise resolving to the permission state
     */
    private ensurePermission;
    /**
     * Create a native notification with the given title and options
     *
     * @param title The notification title
     * @param options The notification options
     * @param onClickCallback Optional callback to invoke when the notification is clicked
     * @returns Promise resolving to the created notification
     */
    private createNotification;
    /**
     * Attempt to focus the application window when notification is clicked
     */
    private focusApplicationWindow;
    /**
     * Get the icon URL for agent completion notifications
     *
     * @returns The icon URL or undefined if not available
     */
    private getAgentCompletionIcon;
}
//# sourceMappingURL=os-notification-service.d.ts.map