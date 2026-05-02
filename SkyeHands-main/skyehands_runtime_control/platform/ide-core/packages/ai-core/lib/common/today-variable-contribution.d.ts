import { MaybePromise } from '@theia/core';
import { AIVariable, ResolvedAIVariable, AIVariableContribution, AIVariableResolver, AIVariableService, AIVariableResolutionRequest, AIVariableContext } from './variable-service';
export declare namespace TodayVariableArgs {
    const IN_UNIX_SECONDS = "inUnixSeconds";
    const IN_ISO_8601 = "inIso8601";
}
export declare const TODAY_VARIABLE: AIVariable;
export interface ResolvedTodayVariable extends ResolvedAIVariable {
    date: Date;
}
export declare class TodayVariableContribution implements AIVariableContribution, AIVariableResolver {
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<ResolvedAIVariable | undefined>;
    private resolveTodayVariable;
}
//# sourceMappingURL=today-variable-contribution.d.ts.map