import { Position, Range } from '@theia/core/shared/vscode-languageserver-protocol';
import { MonacoEditor } from './monaco-editor';
export { peekViewBorder, peekViewTitleBackground, peekViewTitleForeground, peekViewTitleInfoForeground } from '@theia/monaco-editor-core/esm/vs/editor/contrib/peekView/browser/peekView';
export declare namespace MonacoEditorPeekViewWidget {
    interface Styles {
        frameColor?: string;
        arrowColor?: string;
        headerBackgroundColor?: string;
        primaryHeadingColor?: string;
        secondaryHeadingColor?: string;
    }
    interface Options {
        showFrame?: boolean;
        showArrow?: boolean;
        frameWidth?: number;
        className?: string;
        isAccessible?: boolean;
        isResizeable?: boolean;
        keepEditorSelection?: boolean;
        allowUnlimitedHeight?: boolean;
        ordinal?: number;
        showInHiddenAreas?: boolean;
        supportOnTitleClick?: boolean;
    }
    interface Action {
        readonly id: string;
        label: string;
        tooltip: string;
        class: string | undefined;
        enabled: boolean;
        checked?: boolean;
        run(...args: unknown[]): unknown;
    }
    interface ActionOptions {
        icon?: boolean;
        label?: boolean;
        keybinding?: string;
        index?: number;
    }
}
export declare class MonacoEditorPeekViewWidget {
    readonly editor: MonacoEditor;
    protected styles: MonacoEditorPeekViewWidget.Styles;
    protected readonly toDispose: any;
    readonly onDidClose: any;
    private readonly themeService;
    private readonly delegate;
    constructor(editor: MonacoEditor, options?: MonacoEditorPeekViewWidget.Options, styles?: MonacoEditorPeekViewWidget.Styles);
    dispose(): void;
    create(): void;
    setTitle(primaryHeading: string, secondaryHeading?: string): void;
    style(styles: MonacoEditorPeekViewWidget.Styles): void;
    show(rangeOrPos: Range | Position, heightInLines: number): void;
    hide(): void;
    clearActions(): void;
    addAction(id: string, label: string, cssClass: string | undefined, enabled: boolean, actionCallback: (arg: unknown) => unknown, options?: MonacoEditorPeekViewWidget.ActionOptions): MonacoEditorPeekViewWidget.Action;
    protected fillContainer(container: HTMLElement): void;
    protected fillHead(container: HTMLElement, noCloseAction?: boolean): void;
    protected fillBody(container: HTMLElement): void;
    protected doLayoutHead(heightInPixel: number, widthInPixel: number): void;
    protected doLayoutBody(heightInPixel: number, widthInPixel: number): void;
    protected onWidth(widthInPixel: number): void;
    protected doRevealRange(range: Range, isLastLine: boolean): void;
    protected get bodyElement(): HTMLDivElement | undefined;
    protected set bodyElement(element: HTMLDivElement | undefined);
    protected get headElement(): HTMLDivElement | undefined;
    protected set headElement(element: HTMLDivElement | undefined);
    protected setCssClass(className: string, classToReplace?: string | undefined): void;
    private convertStyles;
    private convertColor;
    private convertRangeOrPosition;
}
//# sourceMappingURL=monaco-editor-peek-view-widget.d.ts.map