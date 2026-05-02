import { Event } from '@theia/core';
import { WidgetFactory } from '@theia/core/lib/browser';
import { OutlineViewWidget, OutlineViewWidgetFactory, OutlineSymbolInformationNode } from './outline-view-widget';
import { Widget } from '@theia/core/shared/@lumino/widgets';
export declare class OutlineViewService implements WidgetFactory {
    protected factory: OutlineViewWidgetFactory;
    id: string;
    protected widget?: OutlineViewWidget;
    protected readonly onDidChangeOutlineEmitter: any;
    protected readonly onDidChangeOpenStateEmitter: any;
    protected readonly onDidSelectEmitter: any;
    protected readonly onDidOpenEmitter: any;
    protected readonly onDidTapNodeEmitter: any;
    constructor(factory: OutlineViewWidgetFactory);
    get onDidSelect(): Event<OutlineSymbolInformationNode>;
    get onDidOpen(): Event<OutlineSymbolInformationNode>;
    get onDidChangeOutline(): Event<OutlineSymbolInformationNode[]>;
    get onDidChangeOpenState(): Event<boolean>;
    get onDidTapNode(): Event<OutlineSymbolInformationNode>;
    get open(): boolean;
    didTapNode(node: OutlineSymbolInformationNode): void;
    /**
     * Publish the collection of outline view symbols.
     * - Publishing includes setting the `OutlineViewWidget` tree with symbol information.
     * @param roots the list of outline symbol information nodes.
     */
    publish(roots: OutlineSymbolInformationNode[]): void;
    createWidget(): Promise<Widget>;
}
//# sourceMappingURL=outline-view-service.d.ts.map