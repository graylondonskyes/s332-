import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PromptService } from '../common/prompt-service';
/**
 * Contribution that registers prompt fragments for each generic capability type.
 * These fragments are dynamically added to agent prompts based on user selections
 * from the chat UI dropdowns.
 */
export declare class GenericCapabilitiesPromptFragmentContribution implements FrontendApplicationContribution {
    protected readonly promptService: PromptService;
    onStart(): void;
}
//# sourceMappingURL=generic-capabilities-prompt-fragment-contribution.d.ts.map