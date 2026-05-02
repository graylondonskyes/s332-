import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Agent } from '../common';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
export declare class AICoreFrontendApplicationContribution implements FrontendApplicationContribution {
    private readonly agentService;
    protected readonly agentsProvider: ContributionProvider<Agent>;
    onStart(): void;
    onStop(): void;
}
//# sourceMappingURL=ai-core-frontend-application-contribution.d.ts.map