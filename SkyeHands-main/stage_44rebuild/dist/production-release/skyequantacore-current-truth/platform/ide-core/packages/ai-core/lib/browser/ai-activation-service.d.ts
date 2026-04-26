import { FrontendApplicationContribution } from '@theia/core/lib/browser';
export declare const AIActivationService: unique symbol;
/**
 * AIActivationService is used to manage the activation state of AI features in Theia.
 */
export interface AIActivationService {
    isActive: boolean;
    onDidChangeActiveStatus: Event<boolean>;
}
import { Event } from '@theia/core';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
/**
 * Context key for the AI features. It is set to `true` if the feature is enabled.
 */
export declare const ENABLE_AI_CONTEXT_KEY = "ai-features.AiEnable.enableAI";
/**
 * Default implementation of AIActivationService marks the feature active by default.
 *
 * Adopters may override this implementation to provide custom activation logic.
 *
 * Note that '@theia/ai-ide' also overrides this service to provide activation based on preferences,
 * disabling the feature by default.
 */
export declare class AIActivationServiceImpl implements AIActivationService, FrontendApplicationContribution {
    protected readonly contextKeyService: ContextKeyService;
    isActive: boolean;
    protected onDidChangeAIEnabled: any;
    get onDidChangeActiveStatus(): Event<boolean>;
    initialize(): void;
}
//# sourceMappingURL=ai-activation-service.d.ts.map