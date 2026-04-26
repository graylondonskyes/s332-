import { Event, ILogger, RecursiveReadonly } from '@theia/core';
import { PreferenceService } from '@theia/core/lib/common';
import { AISettings, AISettingsService, AgentSettings } from '../common';
export declare class AISettingsServiceImpl implements AISettingsService {
    protected readonly logger: ILogger;
    protected preferenceService: PreferenceService;
    static readonly PREFERENCE_NAME = "ai-features.agentSettings";
    protected toDispose: any;
    protected readonly onDidChangeEmitter: any;
    onDidChange: Event<void>;
    protected init(): void;
    updateAgentSettings(agent: string, agentSettings: Partial<AgentSettings>): Promise<void>;
    getAgentSettings(agent: string): Promise<RecursiveReadonly<AgentSettings> | undefined>;
    getSettings(): Promise<RecursiveReadonly<AISettings>>;
}
//# sourceMappingURL=ai-settings-service.d.ts.map