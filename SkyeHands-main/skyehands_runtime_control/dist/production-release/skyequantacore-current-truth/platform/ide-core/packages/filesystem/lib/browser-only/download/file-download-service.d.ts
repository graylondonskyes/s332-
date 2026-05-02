import URI from '@theia/core/lib/common/uri';
import { ILogger } from '@theia/core/lib/common/logger';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileSystemPreferences } from '../../common/filesystem-preferences';
import { FileService } from '../../browser/file-service';
import type { FileDownloadService } from '../../common/download/file-download';
import * as tarStream from 'tar-stream';
export declare class FileDownloadServiceImpl implements FileDownloadService {
    protected readonly fileService: FileService;
    protected readonly logger: ILogger;
    protected readonly messageService: MessageService;
    protected readonly preferences: FileSystemPreferences;
    private readonly ignorePatterns;
    protected getFileSizeThreshold(): number;
    /**
     * Check if streaming download is supported (File System Access API)
     */
    protected isStreamingSupported(): boolean;
    download(uris: URI[], options?: never): Promise<void>;
    protected doDownload(uris: URI[], abortSignal: AbortSignal): Promise<void>;
    protected createArchiveBlob(populateArchive: (tarPack: tarStream.Pack) => Promise<void>, abortSignal: AbortSignal): Promise<Blob>;
    /**
     * Create ReadableStream from a single file using FileService streaming
     */
    protected createFileStream(uri: URI, abortSignal: AbortSignal): Promise<ReadableStream<Uint8Array>>;
    protected addFileToArchive(tarPack: tarStream.Pack, file: {
        uri: URI;
        path: string;
        size: number;
    }, abortSignal: AbortSignal): Promise<void>;
    protected addFilesToArchive(tarPack: tarStream.Pack, files: Array<{
        uri: URI;
        path: string;
        size: number;
    }>, directories: Array<{
        path: string;
    }>, abortSignal: AbortSignal): Promise<void>;
    protected createArchiveStream(abortSignal: AbortSignal, populateArchive: (tarPack: tarStream.Pack) => Promise<void>): globalThis.ReadableStream<Uint8Array>;
    protected streamDownloadToFile(uris: URI[], files: Array<{
        uri: URI;
        path: string;
        size: number;
    }>, directories: Array<{
        path: string;
    }>, stats: Array<{
        name: string;
        isDirectory: boolean;
        size?: number;
    }>, abortSignal: AbortSignal): Promise<void>;
    protected blobDownload(data: Blob, filename: string): void;
    protected sanitizeFilename(filename: string): string;
    protected shouldIncludeFile(path: string): boolean;
    /**
     * Collect all files and calculate total size
     */
    protected collectFiles(uris: URI[], abortSignal?: AbortSignal): Promise<{
        files: Array<{
            uri: URI;
            path: string;
            size: number;
        }>;
        directories: Array<{
            path: string;
        }>;
        totalSize: number;
        stats: Array<{
            name: string;
            isDirectory: boolean;
            size?: number;
        }>;
    }>;
    /**
     * Recursively collect files from a directory
     */
    protected collectFilesFromDirectory(dirUri: URI, basePath: string, abortSignal?: AbortSignal): Promise<{
        files: Array<{
            uri: URI;
            path: string;
            size: number;
        }>;
        directories: Array<{
            path: string;
        }>;
    }>;
}
//# sourceMappingURL=file-download-service.d.ts.map