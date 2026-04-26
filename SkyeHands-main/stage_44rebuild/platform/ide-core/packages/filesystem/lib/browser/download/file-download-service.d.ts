import URI from '@theia/core/lib/common/uri';
import { ILogger } from '@theia/core/lib/common/logger';
import { MessageService } from '@theia/core/lib/common/message-service';
import type { FileDownloadData, FileDownloadService } from '../../common/download/file-download';
export declare class FileDownloadServiceImpl implements FileDownloadService {
    protected anchor: HTMLAnchorElement | undefined;
    protected downloadCounter: number;
    protected readonly logger: ILogger;
    protected readonly messageService: MessageService;
    protected handleCopy(event: ClipboardEvent, downloadUrl: string): void;
    cancelDownload(id: string): Promise<void>;
    download(uris: URI[], options?: FileDownloadService.DownloadOptions): Promise<void>;
    protected forceDownload(id: string, title: string): Promise<void>;
    protected request(uris: URI[]): Request;
    protected requestInit(uris: URI[]): RequestInit;
    protected body(uris: URI[]): FileDownloadData;
    protected url(uris: URI[]): string;
    protected endpoint(): string;
    protected filesUrl(): string;
}
//# sourceMappingURL=file-download-service.d.ts.map