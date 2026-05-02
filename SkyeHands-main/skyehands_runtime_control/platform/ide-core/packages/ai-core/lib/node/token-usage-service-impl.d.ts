import { TokenUsage, TokenUsageParams, TokenUsageService } from '../common/token-usage-service';
import { TokenUsageServiceClient } from '../common/protocol';
export declare class TokenUsageServiceImpl implements TokenUsageService {
    private client;
    /**
     * Sets the client to notify about token usage changes
     */
    setClient(client: TokenUsageServiceClient | undefined): void;
    private readonly tokenUsages;
    /**
     * Records token usage for a model interaction.
     *
     * @param model The model identifier
     * @param params Token usage parameters
     * @returns A promise that resolves when the token usage has been recorded
     */
    recordTokenUsage(model: string, params: TokenUsageParams): Promise<void>;
    /**
     * Gets all token usage records stored in this service.
     */
    getTokenUsages(): Promise<TokenUsage[]>;
}
//# sourceMappingURL=token-usage-service-impl.d.ts.map