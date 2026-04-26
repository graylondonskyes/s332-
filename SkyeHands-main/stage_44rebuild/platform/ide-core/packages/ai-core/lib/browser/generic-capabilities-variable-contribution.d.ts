import { MaybePromise } from '@theia/core';
import { AIVariable, AIVariableArg, AIVariableContext, AIVariableContribution, AIVariableResolutionRequest, AIVariableResolverWithVariableDependencies, AIVariableService, ResolvedAIVariable, AgentService, AgentsVariableContribution } from '../common';
import { PromptVariableContribution } from './prompt-variable-contribution';
import { SkillService } from './skill-service';
import { SkillsVariableContribution } from './skills-variable-contribution';
/**
 * Variable IDs for generic capability selections.
 * These variables resolve to lists of selected items from the chat UI dropdowns.
 */
export declare const SELECTED_SKILLS_VARIABLE: AIVariable;
export declare const SELECTED_MCP_FUNCTIONS_VARIABLE: AIVariable;
export declare const SELECTED_FUNCTIONS_VARIABLE: AIVariable;
export declare const SELECTED_PROMPT_FRAGMENTS_VARIABLE: AIVariable;
export declare const SELECTED_AGENT_DELEGATION_VARIABLE: AIVariable;
export declare const SELECTED_VARIABLES_VARIABLE: AIVariable;
/**
 * Contribution that registers variables for resolving user-selected generic capabilities.
 * These variables read from the genericCapabilitySelections field in the context
 * and delegate resolution to the respective variable contributions.
 */
export declare class GenericCapabilitiesVariableContribution implements AIVariableContribution, AIVariableResolverWithVariableDependencies {
    protected readonly skillsContribution: SkillsVariableContribution | undefined;
    protected readonly skillService: SkillService | undefined;
    protected readonly variableService: AIVariableService | undefined;
    protected readonly agentService: AgentService | undefined;
    protected readonly agentsContribution: AgentsVariableContribution | undefined;
    protected readonly promptContribution: PromptVariableContribution | undefined;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, _context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, context: AIVariableContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable | undefined>;
    /**
     * Resolves selected skills using SkillsVariableContribution.resolveSkillsVariable().
     */
    protected resolveSelectedSkills(variable: AIVariable, skillIds: string[] | undefined): ResolvedAIVariable;
    /**
     * Resolves selected functions by outputting ~{functionId} syntax.
     * The chat request parser will pick these up and add them to the toolRequests map.
     */
    protected resolveSelectedFunctions(variable: AIVariable, functionIds: string[] | undefined): ResolvedAIVariable;
    /**
     * Resolves selected prompt fragments using PromptVariableContribution.resolvePromptFragments().
     */
    protected resolveSelectedPromptFragments(variable: AIVariable, fragmentIds: string[] | undefined, context: AIVariableContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable>;
    /**
     * Resolves selected agents for delegation using AgentsVariableContribution.resolveAgentsVariable().
     */
    protected resolveSelectedAgentDelegation(variable: AIVariable, agentIds: string[] | undefined): ResolvedAIVariable;
    /**
     * Resolves selected variables using AIVariableService.resolveVariable().
     */
    protected resolveSelectedVariables(variable: AIVariable, variableNames: string[] | undefined, context: AIVariableContext, resolveDependency?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<ResolvedAIVariable>;
}
//# sourceMappingURL=generic-capabilities-variable-contribution.d.ts.map