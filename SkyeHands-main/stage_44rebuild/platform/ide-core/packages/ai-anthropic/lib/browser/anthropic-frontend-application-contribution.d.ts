import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AnthropicLanguageModelsManager, AnthropicModelDescription } from '../common';
import { AICorePreferences } from '@theia/ai-core/lib/common/ai-core-preferences';
import { PreferenceService } from '@theia/core';
export declare class AnthropicFrontendApplicationContribution implements FrontendApplicationContribution {
    protected preferenceService: PreferenceService;
    protected manager: AnthropicLanguageModelsManager;
    protected aiCorePreferences: AICorePreferences;
    protected prevModels: string[];
    protected prevCustomModels: Partial<AnthropicModelDescription>[];
    onStart(): void;
    protected handleModelChanges(newModels: string[]): void;
    protected handleCustomModelChanges(newCustomModels: Partial<AnthropicModelDescription>[]): void;
    protected updateAllModels(): void;
    protected createAnthropicModelDescription(modelId: string): AnthropicModelDescription;
    protected createCustomModelDescriptionsFromPreferences(preferences: Partial<AnthropicModelDescription>[]): AnthropicModelDescription[];
}
//# sourceMappingURL=anthropic-frontend-application-contribution.d.ts.map