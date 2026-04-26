import { URI } from '@theia/monaco-editor-core/esm/vs/base/common/uri';
import { ISingleFolderWorkspaceIdentifier, IWorkspace, IWorkspaceContextService, IWorkspaceFolder, IWorkspaceIdentifier, WorkbenchState } from '@theia/monaco-editor-core/esm/vs/platform/workspace/common/workspace';
/**
 * A minimal implementation of {@link IWorkspaceContextService} to replace the `StandaloneWorkspaceContextService` in Monaco
 * as a workaround for the issue of showing no context menu for editor minimap (#15217).
 */
export declare class MonacoWorkspaceContextService implements IWorkspaceContextService {
    readonly _serviceBrand: undefined;
    protected readonly onDidChangeWorkbenchStateEmitter: any;
    readonly onDidChangeWorkbenchState: any;
    protected readonly onDidChangeWorkspaceNameEmitter: any;
    readonly onDidChangeWorkspaceName: any;
    protected readonly onWillChangeWorkspaceFoldersEmitter: any;
    readonly onWillChangeWorkspaceFolders: any;
    protected readonly onDidChangeWorkspaceFoldersEmitter: any;
    readonly onDidChangeWorkspaceFolders: any;
    protected workspace: IWorkspace;
    getCompleteWorkspace(): Promise<IWorkspace>;
    getWorkspace(): IWorkspace;
    getWorkbenchState(): WorkbenchState;
    getWorkspaceFolder(resource: URI): IWorkspaceFolder | null;
    isCurrentWorkspace(workspaceIdOrFolder: IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier | URI): boolean;
    isInsideWorkspace(resource: URI): boolean;
}
//# sourceMappingURL=monaco-workspace-context-service.d.ts.map