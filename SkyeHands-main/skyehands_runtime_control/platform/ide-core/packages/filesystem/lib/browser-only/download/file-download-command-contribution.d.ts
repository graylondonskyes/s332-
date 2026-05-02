import URI from '@theia/core/lib/common/uri';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { FileDownloadService } from '../../common/download/file-download';
export declare class FileDownloadCommandContribution implements CommandContribution {
    protected readonly downloadService: FileDownloadService;
    protected readonly selectionService: SelectionService;
    registerCommands(registry: CommandRegistry): void;
    protected executeDownload(uris: URI[], options?: {
        copyLink?: boolean;
    }): Promise<void>;
    protected isDownloadEnabled(uris: URI[]): boolean;
    protected isDownloadVisible(uris: URI[]): boolean;
}
//# sourceMappingURL=file-download-command-contribution.d.ts.map