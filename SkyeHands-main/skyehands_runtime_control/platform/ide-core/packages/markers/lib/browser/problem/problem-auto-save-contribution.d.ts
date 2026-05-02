import { Event } from '@theia/core';
import { SaveErrorChecker } from '@theia/core/lib/browser/saveable-service';
import { ProblemManager } from './problem-manager';
import URI from '@theia/core/lib/common/uri';
export declare class ProblemAutoSaveContribution implements SaveErrorChecker {
    protected readonly problemManager: ProblemManager;
    protected readonly onDidErrorStateChangeEmitter: any;
    get onDidErrorStateChange(): Event<void>;
    protected init(): void;
    hasErrors(uri: URI): boolean;
}
//# sourceMappingURL=problem-auto-save-contribution.d.ts.map