import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { SkillService } from './skill-service';
import { PromptService } from '../common/prompt-service';
export declare class SkillPromptCoordinator implements FrontendApplicationContribution {
    protected readonly skillService: SkillService;
    protected readonly promptService: PromptService;
    protected registeredSkillCommands: Set<string>;
    onStart(): void;
    protected updateSkillCommands(): void;
}
//# sourceMappingURL=skill-prompt-coordinator.d.ts.map