import { Disposable, DisposableCollection, PreferenceService } from '../common';
import { MarkdownString } from '../common/markdown-rendering/markdown-string';
import { MarkdownRenderer, MarkdownRendererFactory } from './markdown-rendering/markdown-renderer';
import '../../src/browser/style/hover-service.css';
export type HoverPosition = 'left' | 'right' | 'top' | 'bottom';
export declare namespace HoverPosition {
    function invertIfNecessary(position: HoverPosition, target: DOMRect, host: DOMRect, totalWidth: number, totalHeight: number): HoverPosition;
}
export interface HoverRequest {
    content: string | MarkdownString | HTMLElement;
    target: HTMLElement;
    /**
     * The position where the hover should appear.
     * Note that the hover service will try to invert the position (i.e. right -> left)
     * if the specified content does not fit in the window next to the target element
     */
    position: HoverPosition;
    /**
     * Additional css classes that should be added to the hover box.
     * Used to style certain boxes different e.g. for the extended tab preview.
     */
    cssClasses?: string[];
    /**
     * A function to render a visual preview on the hover.
     * Function that takes the desired width and returns a HTMLElement to be rendered.
     */
    visualPreview?: (width: number) => HTMLElement | undefined;
    /**
     * Indicates if the hover contains interactive/clickable items.
     * When true, the hover will register a click handler to allow interaction with elements in the hover area.
     */
    interactive?: boolean;
    /**
     * If implemented, this method will be called when the hover is no longer shown or no longer scheduled to be shown.
     */
    onHide?(): void;
    /**
     * When true, the hover will be shown immediately without any delay.
     * Useful for explicitly triggered hovers (e.g., on click) where the user expects instant feedback.
     * @default false
     */
    skipHoverDelay?: boolean;
}
export declare class HoverService {
    protected static hostClassName: string;
    protected static styleSheetId: string;
    protected readonly preferences: PreferenceService;
    protected readonly markdownRendererFactory: MarkdownRendererFactory;
    protected _markdownRenderer: MarkdownRenderer | undefined;
    protected get markdownRenderer(): MarkdownRenderer;
    protected _hoverHost: HTMLElement | undefined;
    protected get hoverHost(): HTMLElement;
    protected pendingTimeout: Disposable | undefined;
    protected hoverTarget: HTMLElement | undefined;
    protected lastHidHover: number;
    protected readonly disposeOnHide: DisposableCollection;
    requestHover(request: HoverRequest): void;
    protected getHoverDelay(): number;
    protected renderHover(request: HoverRequest): Promise<void>;
    protected setHostPosition(target: HTMLElement, host: HTMLElement, position: HoverPosition): HoverPosition;
    protected listenForMouseOut(): void;
    cancelHover(): void;
    /**
     * Listen for mouse click (mousedown) events and handle them based on hover interactivity.
     * For non-interactive hovers, any mousedown cancels the hover immediately.
     * For interactive hovers, the hover remains visible to allow interaction with its elements.
     */
    protected listenForMouseClick(request: HoverRequest): void;
    protected unRenderHover(): void;
}
//# sourceMappingURL=hover-service.d.ts.map