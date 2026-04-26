import URI from '@theia/core/lib/common/uri';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { Progress } from '@theia/core/lib/common/message-service-protocol';
import { Event } from '@theia/core/lib/common/event';
export type CustomDataTransfer = Iterable<readonly [string, CustomDataTransferItem]>;
export interface CustomDataTransferItem {
    asFile(): {
        readonly id: string;
        readonly name: string;
        data(): Promise<Uint8Array>;
    } | undefined;
}
export interface FileUploadService {
    upload(targetUri: string | URI, params?: FileUploadService.UploadParams): Promise<FileUploadService.UploadResult>;
    readonly onDidUpload: Event<string[]>;
}
export declare namespace FileUploadService {
    type Source = FormData | DataTransfer | CustomDataTransfer;
    interface UploadEntry {
        file: File;
        uri: URI;
    }
    interface Context {
        progress: Progress;
        token: CancellationToken;
        accept: (entry: UploadEntry) => Promise<void>;
    }
    interface Form {
        targetInput: HTMLInputElement;
        fileInput: HTMLInputElement;
        onDidUpload?: (uri: string) => void;
    }
    interface UploadParams {
        source?: FileUploadService.Source;
        progress?: Progress;
        token?: CancellationToken;
        onDidUpload?: (uri: string) => void;
        leaveInTemp?: boolean;
    }
    interface UploadResult {
        uploaded: string[];
    }
}
export declare const FileUploadService: unique symbol;
//# sourceMappingURL=file-upload.d.ts.map