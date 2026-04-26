import { MessageService } from '@theia/core/lib/common/message-service';
import { AgentService } from '../common/agent-service';
import { AISettingsService } from '../common/settings-service';
import { OSNotificationService } from './os-notification-service';
import { WindowBlinkService } from './window-blink-service';
import { NotificationType } from '../common/notification-types';
import { PreferenceService } from '@theia/core';
/**
 * Options for showing a completion notification.
 */
export interface CompletionNotificationOptions {
    /**
     * Callback to check if the notification should be suppressed.
     * If returns true, the notification will not be shown.
     */
    shouldSuppress?: () => boolean;
    /**
     * Callback to invoke when the notification is clicked/activated.
     * Used for navigating to the relevant chat session.
     */
    onActivate?: () => void;
    /**
     * Title of the chat session for display in the notification.
     * Helps distinguish between multiple chats with the same agent.
     */
    sessionTitle?: string;
}
export declare class AgentCompletionNotificationService {
    protected readonly preferenceService: PreferenceService;
    protected readonly agentService: AgentService;
    protected readonly settingsService: AISettingsService;
    protected readonly osNotificationService: OSNotificationService;
    protected readonly messageService: MessageService;
    protected readonly windowBlinkService: WindowBlinkService;
    /**
     * Show a completion notification for the specified agent if enabled in preferences.
     *
     * @param agentId The unique identifier of the agent
     * @param options Optional configuration for the notification
     */
    showCompletionNotification(agentId: string, options?: CompletionNotificationOptions): Promise<void>;
    /**
     * Resolve the display name for an agent by its ID.
     *
     * @param agentId The unique identifier of the agent
     * @returns The agent's display name or the agent ID if not found
     */
    protected resolveAgentName(agentId: string): string;
    /**
     * Get the preferred notification type for a specific agent.
     * If no agent-specific preference is set, returns the global default notification type.
     */
    protected getNotificationTypeForAgent(agentId: string): Promise<NotificationType>;
    /**
     * Execute the specified notification type.
     */
    private executeNotificationType;
    /**
     * Show OS notification directly.
     */
    protected showOSNotification(agentName: string, onActivate?: () => void, sessionTitle?: string): Promise<void>;
    /**
     * Show MessageService notification.
     */
    protected showMessageServiceNotification(agentName: string, onActivate?: () => void, sessionTitle?: string): Promise<void>;
    /**
     * Show window blink notification.
     */
    protected showBlinkNotification(agentName: string): Promise<void>;
    /**
     * Check if OS notifications are supported and enabled.
     */
    isOSNotificationSupported(): boolean;
    /**
     * Get the current OS notification permission status.
     */
    getOSNotificationPermission(): NotificationPermission;
    /**
     * Request OS notification permission from the user.
     */
    requestOSNotificationPermission(): Promise<NotificationPermission>;
}
//# sourceMappingURL=agent-completion-notification-service.d.ts.map