import { CorePreferences } from '@theia/core';
import { ApplicationShell, FrontendApplication, FrontendApplicationContribution, NavigatableWidget, OpenerService, WidgetManager } from '@theia/core/lib/browser';
import { MimeService } from '@theia/core/lib/browser/mime-service';
import { MaybePromise, SelectionService } from '@theia/core/lib/common';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import URI from '@theia/core/lib/common/uri';
import { UserWorkingDirectoryProvider } from '@theia/core/lib/browser/user-working-directory-provider';
import { FileChangesEvent } from '../common/files';
import { FileDialogService } from './file-dialog';
import { FileSelection } from './file-selection';
import { FileService, UserFileOperationEvent } from './file-service';
import { FileSystemPreferences } from '../common/filesystem-preferences';
import { FileUploadService } from '../common/upload/file-upload';
export declare namespace FileSystemCommands {
    const UPLOAD: any;
}
export interface NavigatableWidgetMoveSnapshot {
    dirty?: object;
    view?: object;
}
export declare class FileSystemFrontendContribution implements FrontendApplicationContribution, CommandContribution {
    protected readonly shell: ApplicationShell;
    protected readonly widgetManager: WidgetManager;
    protected readonly mimeService: MimeService;
    protected readonly preferences: FileSystemPreferences;
    protected readonly corePreferences: CorePreferences;
    protected readonly selectionService: SelectionService;
    protected readonly uploadService: FileUploadService;
    protected readonly fileService: FileService;
    protected readonly fileDialogService: FileDialogService;
    protected readonly openerService: OpenerService;
    protected readonly workingDirectory: UserWorkingDirectoryProvider;
    protected onDidChangeEditorFileEmitter: any;
    readonly onDidChangeEditorFile: any;
    protected readonly userOperations: Map<number, Deferred<void>>;
    protected queueUserOperation(event: UserFileOperationEvent): void;
    protected resolveUserOperation(event: UserFileOperationEvent): void;
    initialize(): void;
    onStart?(app: FrontendApplication): MaybePromise<void>;
    registerCommands(commands: CommandRegistry): void;
    protected upload(selection: FileSelection): Promise<FileUploadService.UploadResult | undefined>;
    protected doHandleUpload(uploads: string[]): Promise<void>;
    /**
     * Opens a save dialog to create a new file.
     *
     * @param args The first argument is the name of the new file. The second argument is the parent directory URI.
     */
    protected handleNewFileCommand(args: unknown[]): Promise<void>;
    protected getSelection(...args: unknown[]): FileSelection | undefined;
    protected toSelection(arg: unknown): FileSelection | undefined;
    protected pendingOperation: Promise<void>;
    protected run(operation: () => MaybePromise<void>): Promise<void>;
    protected runEach(participant: (resourceUri: URI, widget: NavigatableWidget) => Promise<void>): Promise<void>;
    protected readonly moveSnapshots: Map<string, NavigatableWidgetMoveSnapshot>;
    protected popMoveSnapshot(resourceUri: URI): NavigatableWidgetMoveSnapshot | undefined;
    protected applyMoveSnapshot(widget: NavigatableWidget, snapshot: NavigatableWidgetMoveSnapshot | undefined): void;
    protected pushMove(resourceUri: URI, widget: NavigatableWidget, event: UserFileOperationEvent): Promise<void>;
    protected revertMove(resourceUri: URI, widget: NavigatableWidget, event: UserFileOperationEvent): Promise<void>;
    protected applyMove(resourceUri: URI, widget: NavigatableWidget, event: UserFileOperationEvent): Promise<void>;
    protected createMoveToUri(resourceUri: URI, widget: NavigatableWidget, event: UserFileOperationEvent): URI | undefined;
    protected readonly deletedSuffix: string;
    protected updateWidgets(event: FileChangesEvent): Promise<void>;
    protected updateWidget(uri: URI, widget: NavigatableWidget, event: FileChangesEvent, { dirty, toClose }: {
        dirty: Set<string>;
        toClose: Map<string, NavigatableWidget[]>;
    }): void;
    protected updateAssociations(): void;
}
//# sourceMappingURL=filesystem-frontend-contribution.d.ts.map