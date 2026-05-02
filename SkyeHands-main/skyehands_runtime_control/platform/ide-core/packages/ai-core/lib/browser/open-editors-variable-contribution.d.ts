import { MaybePromise } from '@theia/core';
import { EditorManager } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { AIVariable, ResolvedAIVariable, AIVariableContribution, AIVariableResolver, AIVariableService, AIVariableResolutionRequest, AIVariableContext } from '../common';
export declare const OPEN_EDITORS_VARIABLE: AIVariable;
export declare const OPEN_EDITORS_SHORT_VARIABLE: AIVariable;
export declare class OpenEditorsVariableContribution implements AIVariableContribution, AIVariableResolver {
    protected readonly editorManager: EditorManager;
    protected readonly workspaceService: WorkspaceService;
    registerVariables(service: AIVariableService): void;
    canResolve(request: AIVariableResolutionRequest, _context: AIVariableContext): MaybePromise<number>;
    resolve(request: AIVariableResolutionRequest, _context: AIVariableContext): Promise<ResolvedAIVariable | undefined>;
    protected getAllOpenFilesRelative(): string;
    protected getWorkspaceRelativePath(uri: URI): string | undefined;
}
//# sourceMappingURL=open-editors-variable-contribution.d.ts.map