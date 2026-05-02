import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { VariableRegistry, VariableResolverService } from '@theia/variable-resolver/lib/browser';
import { AIVariableContribution, AIVariableResolver, AIVariableService, AIVariableResolutionRequest, AIVariableContext, ResolvedAIVariable } from '../common';
/**
 * Mapping configuration for a Theia variable to one or more AI variables
 */
interface VariableMapping {
    name?: string;
    description?: string;
}
/**
 * Integrates the Theia VariableRegistry with the Theia AI VariableService
 */
export declare class TheiaVariableContribution implements AIVariableContribution, AIVariableResolver {
    private static readonly THEIA_PREFIX;
    protected readonly variableResolverService: VariableResolverService;
    protected readonly variableRegistry: VariableRegistry;
    protected readonly stateService: FrontendApplicationStateService;
    protected variableRenameMap: Map<string, VariableMapping[]>;
    registerVariables(service: AIVariableService): void;
    protected toTheiaVariable(request: AIVariableResolutionRequest): string;
    canResolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<number>;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<ResolvedAIVariable | undefined>;
}
export {};
//# sourceMappingURL=theia-variable-contribution.d.ts.map