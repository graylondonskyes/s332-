import { URI } from '@theia/core';
import { OpenerService } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { AIVariable, AIVariableContext, AIVariableContribution, AIVariableOpener, AIVariableResolutionRequest, AIVariableResolver, ResolvedAIContextVariable } from '../common/variable-service';
import { FrontendVariableService } from './frontend-variable-service';
export declare namespace FileVariableArgs {
    const uri = "uri";
}
export declare const FILE_VARIABLE: AIVariable;
export declare class FileVariableContribution implements AIVariableContribution, AIVariableResolver, AIVariableOpener {
    protected readonly fileService: FileService;
    protected readonly wsService: WorkspaceService;
    protected readonly openerService: OpenerService;
    registerVariables(service: FrontendVariableService): void;
    canResolve(request: AIVariableResolutionRequest, _: AIVariableContext): Promise<number>;
    resolve(request: AIVariableResolutionRequest, _: AIVariableContext): Promise<ResolvedAIContextVariable | undefined>;
    protected toUri(request: AIVariableResolutionRequest): Promise<URI | undefined>;
    canOpen(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<number>;
    open(request: AIVariableResolutionRequest, context: AIVariableContext): Promise<void>;
    protected makeAbsolute(pathStr: string): Promise<URI | undefined>;
}
//# sourceMappingURL=file-variable-contribution.d.ts.map