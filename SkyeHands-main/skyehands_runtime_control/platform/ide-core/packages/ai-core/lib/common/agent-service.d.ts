import { Event } from '@theia/core';
import { Agent } from './agent';
import { AISettingsService } from './settings-service';
import { PromptService } from './prompt-service';
export declare const AgentService: unique symbol;
/**
 * Service to access the list of known Agents.
 */
export interface AgentService {
    /**
     * Retrieves a list of all available agents, i.e. agents which are not disabled
     */
    getAgents(): Agent[];
    /**
     * Retrieves a list of all agents, including disabled ones.
     */
    getAllAgents(): Agent[];
    /**
     * Enable the agent with the specified id.
     * @param agentId the agent id.
     */
    enableAgent(agentId: string): Promise<void>;
    /**
     * disable the agent with the specified id.
     * @param agentId the agent id.
     */
    disableAgent(agentId: string): Promise<void>;
    /**
     * query whether this agent is currently enabled or disabled.
     * @param agentId the agent id.
     * @return true if the agent is enabled, false otherwise.
     */
    isEnabled(agentId: string): boolean;
    /**
     * Allows to register an agent programmatically.
     * @param agent the agent to register
     */
    registerAgent(agent: Agent): void;
    /**
     * Allows to unregister an agent programmatically.
     * @param agentId the agent id to unregister
     */
    unregisterAgent(agentId: string): void;
    /**
     * Emitted when the list of agents changes.
     * This can be used to update the UI when agents are added or removed.
     */
    onDidChangeAgents: Event<void>;
}
export declare class AgentServiceImpl implements AgentService {
    protected readonly aiSettingsService: AISettingsService | undefined;
    protected readonly promptService: PromptService;
    protected disabledAgents: Set<string>;
    protected _agents: Agent[];
    private readonly onDidChangeAgentsEmitter;
    readonly onDidChangeAgents: any;
    protected init(): void;
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): void;
    getAgents(): Agent[];
    getAllAgents(): Agent[];
    enableAgent(agentId: string): Promise<void>;
    disableAgent(agentId: string): Promise<void>;
    isEnabled(agentId: string): boolean;
}
//# sourceMappingURL=agent-service.d.ts.map