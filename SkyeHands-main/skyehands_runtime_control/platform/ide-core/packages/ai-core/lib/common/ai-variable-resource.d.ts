import { URI } from '@theia/core';
import { AIVariableContext, AIVariableResolutionRequest } from './variable-service';
import { ConfigurableInMemoryResources, ConfigurableMutableReferenceResource } from './configurable-in-memory-resources';
export declare const AI_VARIABLE_RESOURCE_SCHEME = "ai-variable";
export declare const NO_CONTEXT_AUTHORITY = "context-free";
export declare class AIVariableResourceResolver {
    protected readonly inMemoryResources: ConfigurableInMemoryResources;
    protected init(): void;
    protected readonly cache: Map<string, [Resource, AIVariableContext]>;
    getOrCreate(request: AIVariableResolutionRequest, context: AIVariableContext, value: string): ConfigurableMutableReferenceResource;
    protected toUri(request: AIVariableResolutionRequest, context: AIVariableContext): URI;
    protected toAuthority(context: AIVariableContext): string;
    fromUri(uri: URI): {
        variableName: string;
        arg: string | undefined;
    } | undefined;
}
//# sourceMappingURL=ai-variable-resource.d.ts.map