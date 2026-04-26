import { MarkdownRendererService as CodeMarkdownRenderer } from '@theia/monaco-editor-core/esm/vs/platform/markdown/browser/markdownRenderer';
import * as monaco from '@theia/monaco-editor-core';
import { OpenerService } from '@theia/core/lib/browser';
import { OpenExternalOptions, OpenInternalOptions } from '@theia/monaco-editor-core/esm/vs/platform/opener/common/opener';
import { MarkdownRenderer, MarkdownRenderOptions, MarkdownRenderResult } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { MarkdownRenderOptions as MonacoMarkdownRenderOptions } from '@theia/monaco-editor-core/esm/vs/base/browser/markdownRenderer';
import { MarkdownString } from '@theia/core/lib/common/markdown-rendering';
import { DisposableStore } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { DisposableGroup } from '@theia/core';
export declare class MonacoMarkdownRenderer implements MarkdownRenderer {
    protected readonly openerService: OpenerService;
    protected delegate: CodeMarkdownRenderer;
    protected _openerService: OpenerService | undefined;
    render(markdown: MarkdownString, options?: MarkdownRenderOptions): MarkdownRenderResult;
    protected transformOptions(options?: MarkdownRenderOptions): MonacoMarkdownRenderOptions | undefined;
    protected toDisposableStore(current: DisposableGroup): DisposableStore;
    protected init(): void;
    protected interceptOpen(monacoUri: monaco.Uri | string, monacoOptions?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;
}
//# sourceMappingURL=monaco-markdown-renderer.d.ts.map