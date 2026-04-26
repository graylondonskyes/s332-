import { MenuPath } from '@theia/core/lib/common';
import { MonacoContextMenuService } from '@theia/monaco/lib/browser/monaco-context-menu';
export declare namespace OutputContextMenu {
    const MENU_PATH: MenuPath;
    const TEXT_EDIT_GROUP: any[];
    const COMMAND_GROUP: any[];
    const WIDGET_GROUP: any[];
}
export declare class OutputContextMenuService extends MonacoContextMenuService {
    protected menuPath(): MenuPath;
}
//# sourceMappingURL=output-context-menu.d.ts.map