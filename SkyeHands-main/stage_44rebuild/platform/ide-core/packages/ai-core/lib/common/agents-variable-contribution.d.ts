import { AIVariable, AIVariableContext, AIVariableContribution, AIVariableResolutionRequest, AIVariableResolver, AIVariableService, ResolvedAIVariable } from './variable-service';
import { MaybePromise } from '@theia/core';
import { AgentService } from './agent-service';
import { Agent } from './agent';
export declare const AGENTS_VARIABLE: AIVariable;
export interface ResolvedAgentsVariable extends ResolvedAIVariable {
    agents: AgentDescriptor[];
}
export interface AgentDescriptor {
    id: string;
    name: string;
    description: string;
}
export declare class AgentsVariableContribution implements AIVariableContribution, AIVariableResolver {
    protected readonly agentService: AgentService;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, _context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<ResolvedAgentsVariable | undefined>;
    resolveAgentsVariable(includedAgents: Agent[], variable: AIVariable): ResolvedAgentsVariable;
}
//# sourceMappingURL=agents-variable-contribution.d.ts.map