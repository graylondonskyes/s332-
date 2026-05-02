import { ModelTokenUsageData, TokenUsageFrontendService } from './token-usage-frontend-service';
import { TokenUsage, TokenUsageService } from '../common/token-usage-service';
import { TokenUsageServiceClient } from '../common/protocol';
export declare class TokenUsageServiceClientImpl implements TokenUsageServiceClient {
    private readonly _onTokenUsageUpdated;
    readonly onTokenUsageUpdated: any;
    notifyTokenUsage(usage: TokenUsage): void;
}
export declare class TokenUsageFrontendServiceImpl implements TokenUsageFrontendService {
    protected readonly tokenUsageServiceClient: TokenUsageServiceClient;
    protected readonly tokenUsageService: TokenUsageService;
    private readonly _onTokenUsageUpdated;
    readonly onTokenUsageUpdated: any;
    private cachedUsageData;
    protected init(): void;
    /**
     * Gets the current token usage data for all models
     */
    getTokenUsageData(): Promise<ModelTokenUsageData[]>;
    /**
     * Aggregates token usages by model
     */
    private aggregateTokenUsages;
}
//# sourceMappingURL=token-usage-frontend-service-impl.d.ts.map