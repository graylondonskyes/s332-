import { type URI } from '@theia/core/lib/common';
export interface FileDownloadData {
    readonly uris: string[];
}
export declare namespace FileDownloadData {
    function is(arg: unknown): arg is FileDownloadData;
}
export declare namespace FileDownloadService {
    interface DownloadOptions {
        readonly copyLink?: boolean;
    }
}
export declare const FileDownloadService: unique symbol;
export interface FileDownloadService {
    download(uris: URI[], options?: FileDownloadService.DownloadOptions): Promise<void>;
}
//# sourceMappingURL=file-download.d.ts.map