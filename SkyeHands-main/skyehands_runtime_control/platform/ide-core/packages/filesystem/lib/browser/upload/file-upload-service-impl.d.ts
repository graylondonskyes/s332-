import URI from '@theia/core/lib/common/uri';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Progress } from '@theia/core/lib/common/message-service-protocol';
import { FileSystemPreferences } from '../../common/filesystem-preferences';
import { FileService } from '../file-service';
import { Event } from '@theia/core/lib/common/event';
import type { CustomDataTransfer, FileUploadService } from '../../common/upload/file-upload';
interface UploadFilesParams {
    source: FileUploadService.Source;
    progress: Progress;
    token: CancellationToken;
    leaveInTemp?: boolean;
    onDidUpload?: (uri: string) => void;
}
export declare const HTTP_UPLOAD_URL: string;
export declare class FileUploadServiceImpl implements FileUploadService {
    static TARGET: string;
    static UPLOAD: string;
    protected readonly onDidUploadEmitter: any;
    get onDidUpload(): Event<string[]>;
    protected uploadForm: FileUploadService.Form;
    protected deferredUpload?: Deferred<FileUploadService.UploadResult>;
    protected readonly messageService: MessageService;
    protected fileSystemPreferences: FileSystemPreferences;
    protected fileService: FileService;
    get maxConcurrentUploads(): number;
    protected init(): void;
    protected createUploadForm(): FileUploadService.Form;
    upload(targetUri: string | URI, params?: FileUploadService.UploadParams): Promise<FileUploadService.UploadResult>;
    protected getUploadUrl(): string;
    protected uploadAll(targetUri: URI, params: UploadFilesParams): Promise<FileUploadService.UploadResult>;
    protected confirmOverwrite(fileUri: URI): Promise<boolean>;
    protected uploadFile(file: File, targetUri: URI, token: CancellationToken, leaveInTemp: boolean | undefined, onProgress: (total: number, done: number) => void): {
        /**
         * Promise that resolves once the uploading is finished.
         *
         * Rejects on network error.
         * Rejects if status is not OK (200).
         * Rejects if cancelled.
         */
        upload: Promise<void>;
        /**
         * Promise that resolves after the uploading step, once the server answers back.
         *
         * Rejects on network error.
         * Rejects if status is not OK (200).
         * Rejects if cancelled.
         */
        response: Promise<void>;
    };
    /**
     * Utility function to attach events and get a callback to unregister those.
     *
     * You may not call `unregister` in the same tick as `register` is invoked.
     */
    protected registerEvents(target: EventTarget, register: (unregister: () => void) => Record<string, EventListenerOrEventListenerObject>): void;
    protected withProgress<T>(cb: (progress: Progress, token: CancellationToken) => Promise<T>): Promise<T>;
    protected index(targetUri: URI, source: FileUploadService.Source, context: FileUploadService.Context): Promise<void>;
    protected indexFormData(targetUri: URI, formData: FormData, context: FileUploadService.Context): Promise<void>;
    protected indexDataTransfer(targetUri: URI, dataTransfer: DataTransfer, context: FileUploadService.Context): Promise<void>;
    protected indexCustomDataTransfer(targetUri: URI, dataTransfer: CustomDataTransfer, context: FileUploadService.Context): Promise<void>;
    protected indexFileList(targetUri: URI, files: FileList, context: FileUploadService.Context): Promise<void>;
    protected indexFile(targetUri: URI, file: File, context: FileUploadService.Context): Promise<void>;
    protected indexDataTransferItemList(targetUri: URI, items: DataTransferItemList, context: FileUploadService.Context): Promise<void>;
    protected indexEntry(targetUri: URI, entry: WebKitEntry | null, context: FileUploadService.Context): Promise<void>;
    /**
     *  Read all entries within a folder by block of 100 files or folders until the
     *  whole folder has been read.
     */
    protected indexDirectoryEntry(targetUri: URI, entry: WebKitDirectoryEntry, context: FileUploadService.Context): Promise<void>;
    protected indexEntries(targetUri: URI, entries: WebKitEntry[], context: FileUploadService.Context): Promise<void>;
    protected indexFileEntry(targetUri: URI, entry: WebKitFileEntry, context: FileUploadService.Context): Promise<void>;
}
export {};
//# sourceMappingURL=file-upload-service-impl.d.ts.map