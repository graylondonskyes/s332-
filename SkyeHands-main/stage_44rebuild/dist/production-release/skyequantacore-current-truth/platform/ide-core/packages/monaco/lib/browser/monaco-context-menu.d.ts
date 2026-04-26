import { MenuPath } from '@theia/core/lib/common/menu';
import { Anchor, ContextMenuRenderer, Coordinate } from '@theia/core/lib/browser';
import { Menu } from '@theia/core/shared/@lumino/widgets';
import { IContextMenuService } from '@theia/monaco-editor-core/esm/vs/platform/contextview/browser/contextView';
import { IContextMenuDelegate } from '@theia/monaco-editor-core/esm/vs/base/browser/contextmenu';
import { IAction } from '@theia/monaco-editor-core/esm/vs/base/common/actions';
import { Event } from '@theia/monaco-editor-core/esm/vs/base/common/event';
import { StandardMouseEvent } from '@theia/monaco-editor-core/esm/vs/base/browser/mouseEvent';
export declare class MonacoContextMenuService implements IContextMenuService {
    readonly _serviceBrand: undefined;
    protected readonly onDidShowContextMenuEmitter: any;
    readonly onDidShowContextMenu: Event<void>;
    protected readonly onDidHideContextMenuEmitter: any;
    readonly onDidHideContextMenu: Event<void>;
    protected readonly contextMenuRenderer: ContextMenuRenderer;
    toAnchor(anchor: HTMLElement | Coordinate | StandardMouseEvent): Anchor;
    private getContext;
    showContextMenu(delegate: IContextMenuDelegate): void;
    protected populateMenu(menu: Menu, actions: readonly IAction[]): void;
    protected menuPath(): MenuPath;
}
//# sourceMappingURL=monaco-context-menu.d.ts.map