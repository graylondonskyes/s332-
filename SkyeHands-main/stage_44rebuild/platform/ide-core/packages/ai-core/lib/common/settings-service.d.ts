import { Event } from '@theia/core';
import { LanguageModelRequirement } from './language-model';
import { NotificationType } from './notification-types';
import { GenericCapabilitySelections } from './capability-utils';
export declare const AISettingsService: unique symbol;
/**
 * Service to store and retrieve settings on a per-agent basis.
 */
export interface AISettingsService {
    updateAgentSettings(agent: string, agentSettings: Partial<AgentSettings>): Promise<void>;
    getAgentSettings(agent: string): Promise<AgentSettings | undefined>;
    getSettings(): Promise<AISettings>;
    onDidChange: Event<void>;
}
export type AISettings = Record<string, AgentSettings>;
export interface AgentSettings {
    languageModelRequirements?: LanguageModelRequirement[];
    enable?: boolean;
    /**
     * Whether the agent should be shown in the chat UI.
     * If undefined, defaults to true.
     */
    showInChat?: boolean;
    /**
     * A mapping of main template IDs to their selected variant IDs.
     * If a main template is not present in this mapping, it means the main template is used.
     */
    selectedVariants?: Record<string, string>;
    /**
     * Configuration for completion notifications when the agent finishes a task.
     * If undefined, defaults to 'off'.
     */
    completionNotification?: NotificationType;
    /**
     * User overrides for template-based capabilities.
     * Keys are capability fragment IDs, values are enabled/disabled state.
     * Only stores explicit user choices that differ from template defaults.
     */
    capabilityOverrides?: Record<string, boolean>;
    /**
     * User selections for generic capabilities (skills, functions, MCP tools, etc.).
     * Stores selected IDs for each capability type.
     */
    genericCapabilitySelections?: GenericCapabilitySelections;
}
//# sourceMappingURL=settings-service.d.ts.map