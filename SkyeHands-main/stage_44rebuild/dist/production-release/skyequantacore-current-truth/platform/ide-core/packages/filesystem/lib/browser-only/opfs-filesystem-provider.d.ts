import { FileDeleteOptions, FileOverwriteOptions, FileSystemProviderCapabilities, FileSystemProviderWithFileReadWriteCapability, FileSystemProviderWithFileFolderCopyCapability, FileSystemProviderWithOpenReadWriteCloseCapability, FileType, FileWriteOptions, Stat, WatchOptions, FileOpenOptions, FileUpdateOptions, FileUpdateResult, type FileReadStreamOptions } from '../common/files';
import { Event, URI, Disposable, type CancellationToken } from '@theia/core';
import { EncodingService } from '@theia/core/lib/common/encoding-service';
import { TextDocumentContentChangeEvent } from '@theia/core/shared/vscode-languageserver-protocol';
import { OPFSInitialization } from './opfs-filesystem-initialization';
import { ReadableStreamEvents } from '@theia/core/lib/common/stream';
export declare class OPFSFileSystemProvider implements Disposable, FileSystemProviderWithFileReadWriteCapability, FileSystemProviderWithOpenReadWriteCloseCapability, FileSystemProviderWithFileFolderCopyCapability {
    private readonly BUFFER_SIZE;
    capabilities: FileSystemProviderCapabilities;
    onDidChangeCapabilities: Event<void>;
    private readonly onDidChangeFileEmitter;
    readonly onDidChangeFile: any;
    readonly onFileWatchError: Event<void>;
    protected readonly initialization: OPFSInitialization;
    protected readonly encodingService: EncodingService;
    private fs;
    private initialized;
    protected readonly toDispose: any;
    /**
     * Initializes the OPFS file system provider
     */
    protected init(): void;
    /**
     * Watches a resource for file system changes
     */
    watch(resource: URI, opts: WatchOptions): Disposable;
    /**
     * Creates an index from the map of entries
     */
    createIndex(entries: Map<URI, Uint8Array>): Promise<void>;
    /**
     * Retrieves the current file system index
     */
    index(): Promise<Map<URI, Stat>>;
    /**
     * Clears the file system
     */
    clear(): Promise<void>;
    /**
     * Checks if a resource exists
     */
    exists(resource: URI): Promise<boolean>;
    /**
     * Gets file system statistics for a resource
     */
    stat(resource: URI): Promise<Stat>;
    /**
     * Creates a directory
     */
    mkdir(resource: URI): Promise<void>;
    /**
     * Reads directory contents
     */
    readdir(resource: URI): Promise<[string, FileType][]>;
    /**
     * Deletes a resource
     */
    delete(resource: URI, opts: FileDeleteOptions): Promise<void>;
    /**
     * Renames a resource from one location to another
     */
    rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;
    /**
     * Copies a resource from one location to another
     */
    copy(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void>;
    /**
     * Reads file content as binary data
     */
    readFile(resource: URI): Promise<Uint8Array>;
    /**
     * Reads file content as a stream
     */
    readFileStream(resource: URI, opts: FileReadStreamOptions, token: CancellationToken): ReadableStreamEvents<Uint8Array>;
    /**
     * Writes binary content to a file
     */
    writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void>;
    /**
     * Opens a file and returns a file descriptor
     */
    open(resource: URI, opts: FileOpenOptions): Promise<number>;
    /**
     * Closes a file descriptor
     */
    close(fd: number): Promise<void>;
    /**
     * Reads data from a file descriptor
     */
    read(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
    /**
     * Writes data to a file descriptor
     */
    write(fd: number, pos: number, data: Uint8Array, offset: number, length: number): Promise<number>;
    /**
     * Updates a text file with content changes
     */
    updateFile(resource: URI, changes: TextDocumentContentChangeEvent[], opts: FileUpdateOptions): Promise<FileUpdateResult>;
    /**
     * Handles file system change events from BroadcastChannel
     */
    private handleFileSystemChange;
    /**
     * Disposes the file system provider
     */
    dispose(): void;
}
//# sourceMappingURL=opfs-filesystem-provider.d.ts.map