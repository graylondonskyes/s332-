import { CommandRegistry } from '@theia/core/lib/common/command';
import { Disposable } from '@theia/core/lib/common/disposable';
import { ICommandEvent, ICommandService } from '@theia/monaco-editor-core/esm/vs/platform/commands/common/commands';
import { StandaloneCommandService } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import * as monaco from '@theia/monaco-editor-core';
export declare class MonacoCommandService implements ICommandService, Disposable {
    protected readonly commandRegistry: CommandRegistry;
    readonly _serviceBrand: undefined;
    protected readonly onWillExecuteCommandEmitter: any;
    protected readonly onDidExecuteCommandEmitter: any;
    protected readonly toDispose: any;
    protected delegate: StandaloneCommandService | undefined;
    constructor(commandRegistry: CommandRegistry);
    init(): void;
    dispose(): void;
    get onWillExecuteCommand(): monaco.IEvent<ICommandEvent>;
    get onDidExecuteCommand(): monaco.IEvent<ICommandEvent>;
    executeCommand(commandId: any, ...args: any[]): Promise<any>;
    executeMonacoCommand(commandId: any, ...args: any[]): Promise<any>;
}
//# sourceMappingURL=monaco-command-service.d.ts.map