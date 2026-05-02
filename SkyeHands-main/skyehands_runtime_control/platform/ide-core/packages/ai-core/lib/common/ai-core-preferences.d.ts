import { PreferenceProxy } from '@theia/core/lib/common';
import { interfaces } from '@theia/core/shared/inversify';
import { NotificationType } from './notification-types';
import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';
export declare const AI_CORE_PREFERENCES_TITLE: any;
export declare const PREFERENCE_NAME_PROMPT_TEMPLATES = "ai-features.promptTemplates.promptTemplatesFolder";
export declare const PREFERENCE_NAME_REQUEST_SETTINGS = "ai-features.modelSettings.requestSettings";
export declare const PREFERENCE_NAME_THINKING_MODE = "ai-features.thinkingMode.defaults";
export declare const PREFERENCE_NAME_MAX_RETRIES = "ai-features.modelSettings.maxRetries";
export declare const PREFERENCE_NAME_DEFAULT_NOTIFICATION_TYPE = "ai-features.notifications.default";
export declare const PREFERENCE_NAME_SKILL_DIRECTORIES = "ai-features.skills.skillDirectories";
export declare const LANGUAGE_MODEL_ALIASES_PREFERENCE = "ai-features.languageModelAliases";
export declare const aiCorePreferenceSchema: PreferenceSchema;
export interface AICoreConfiguration {
    [PREFERENCE_NAME_PROMPT_TEMPLATES]: string | undefined;
    [PREFERENCE_NAME_REQUEST_SETTINGS]: Array<RequestSetting> | undefined;
    [PREFERENCE_NAME_THINKING_MODE]: Array<ThinkingModeSetting> | undefined;
    [PREFERENCE_NAME_MAX_RETRIES]: number | undefined;
    [PREFERENCE_NAME_DEFAULT_NOTIFICATION_TYPE]: NotificationType | undefined;
    [PREFERENCE_NAME_SKILL_DIRECTORIES]: string[] | undefined;
}
export interface RequestSetting {
    scope?: Scope;
    clientSettings?: {
        keepToolCalls: boolean;
        keepThinking: boolean;
    };
    requestSettings?: {
        [key: string]: unknown;
    };
}
export interface Scope {
    modelId?: string;
    providerId?: string;
    agentId?: string;
}
export interface ThinkingModeSetting {
    scope?: Scope;
    thinkingMode?: {
        enabled: boolean;
        budgetTokens?: number;
    };
}
export declare const AICorePreferences: unique symbol;
export type AICorePreferences = PreferenceProxy<AICoreConfiguration>;
export declare function bindAICorePreferences(bind: interfaces.Bind): void;
/**
 * Calculates the specificity score of a RequestSetting for a given scope.
 * The score is calculated based on matching criteria:
 * - Agent match: 100 points
 * - Model match: 10 points
 * - Provider match: 1 point
 *
 * @param setting RequestSetting object to check against
 * @param scope Optional scope object containing modelId, providerId, and agentId
 * @returns Specificity score (-1 for non-match, or sum of matching criteria points)
 */
export declare const getRequestSettingSpecificity: (setting: RequestSetting, scope?: Scope) => number;
//# sourceMappingURL=ai-core-preferences.d.ts.map