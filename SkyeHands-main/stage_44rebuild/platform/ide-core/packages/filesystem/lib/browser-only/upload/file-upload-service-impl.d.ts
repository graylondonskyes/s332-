import URI from '@theia/core/lib/common/uri';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Progress } from '@theia/core/lib/common/message-service-protocol';
import { FileService } from '../../browser/file-service';
import { Event } from '@theia/core/lib/common/event';
import { FileSystemPreferences } from '../../common/filesystem-preferences';
import type { FileUploadService } from '../../common/upload/file-upload';
interface UploadFilesParams {
    source: FileUploadService.Source;
    progress: Progress;
    token: CancellationToken;
    onDidUpload?: (uri: string) => void;
}
export declare class FileUploadServiceImpl implements FileUploadService {
    static TARGET: string;
    static UPLOAD: string;
    protected readonly onDidUploadEmitter: any;
    protected uploadForm: FileUploadService.Form;
    protected deferredUpload?: Deferred<FileUploadService.UploadResult>;
    protected fileSystemPreferences: FileSystemPreferences;
    protected fileService: FileService;
    protected readonly messageService: MessageService;
    private readonly ignorePatterns;
    get onDidUpload(): Event<string[]>;
    get maxConcurrentUploads(): number;
    protected init(): void;
    protected createUploadForm(): FileUploadService.Form;
    upload(targetUri: string | URI, params: FileUploadService.UploadParams): Promise<FileUploadService.UploadResult>;
    protected withProgress<T>(cb: (progress: Progress, token: CancellationToken) => Promise<T>): Promise<T>;
    protected confirmOverwrite(fileUri: URI): Promise<boolean>;
    /**
     * Upload all files to the filesystem
     */
    protected uploadFiles(targetUri: URI, params: UploadFilesParams): Promise<FileUploadService.UploadResult>;
    /**
     * Upload (write) a file directly to the filesystem
     */
    protected uploadFile(file: File, targetUri: URI): Promise<void>;
    /**
     * Normalize sources into an array of { file, uri } objects
     */
    protected enumerateFiles(targetUri: URI, source: FileUploadService.Source, token: CancellationToken): Promise<{
        file: File;
        uri: URI;
    }[]>;
    /**
     * Traverse WebKit Entries (files and folders)
     */
    protected traverseEntry(base: URI, entry: WebKitEntry, token: CancellationToken): Promise<{
        file: File;
        uri: URI;
    }[]>;
    /**
     * Read all entries from a WebKit directory entry
     */
    protected readAllEntries(dir: WebKitDirectoryEntry, token: CancellationToken): Promise<WebKitEntry[]>;
    /**
     * Read a file from a WebKit file entry
     */
    protected readFileEntry(fileEntry: WebKitFileEntry, token: CancellationToken): Promise<File>;
    protected supportsWebKitEntries(): boolean;
    protected shouldIncludeFile(path: string): boolean;
}
export {};
//# sourceMappingURL=file-upload-service-impl.d.ts.map