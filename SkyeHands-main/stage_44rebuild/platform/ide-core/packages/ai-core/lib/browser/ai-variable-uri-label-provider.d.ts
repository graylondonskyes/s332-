import { URI } from '@theia/core';
import { LabelProvider, LabelProviderContribution } from '@theia/core/lib/browser';
import { AIVariableResourceResolver } from '../common/ai-variable-resource';
import { AIVariableResolutionRequest, AIVariableService } from '../common/variable-service';
export declare class AIVariableUriLabelProvider implements LabelProviderContribution {
    protected readonly labelProvider: LabelProvider;
    protected variableResourceResolver: AIVariableResourceResolver;
    protected readonly variableService: AIVariableService;
    protected isMine(element: object): element is URI;
    canHandle(element: object): number;
    getIcon(element: object): string | undefined;
    getName(element: object): string | undefined;
    getLongName(element: object): string | undefined;
    getDetails(element: object): string | undefined;
    protected getResolutionRequest(element: object): AIVariableResolutionRequest | undefined;
}
//# sourceMappingURL=ai-variable-uri-label-provider.d.ts.map