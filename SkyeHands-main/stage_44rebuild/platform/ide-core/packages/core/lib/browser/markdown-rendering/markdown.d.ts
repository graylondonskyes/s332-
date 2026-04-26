import * as React from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { MarkdownString } from '../../common/markdown-rendering/markdown-string';
import { FormatType } from '../../common/i18n/localization';
export interface MarkdownProps {
    /**
     * The markdown content to render. Can be a string, a MarkdownString, or undefined.
     * If undefined or empty, an empty div will be rendered.
     */
    markdown?: string | MarkdownString;
    /**
     * The MarkdownRenderer instance to use for rendering.
     */
    markdownRenderer: MarkdownRenderer;
    /**
     * Additional CSS class name(s) to apply to the container element.
     */
    className?: string;
    /**
     * Options to pass to MarkdownStringImpl if markdown is a string.
     * Common options include:
     * - supportHtml: Allow HTML in markdown (default: false)
     * - supportThemeIcons: Allow theme icons (default: false)
     * - isTrusted: Trust level for command execution (default: false)
     */
    markdownOptions?: {
        supportHtml?: boolean;
        supportThemeIcons?: boolean;
        isTrusted?: boolean | {
            enabledCommands: string[];
        };
    };
    /**
     * Optional callback that receives the rendered HTML element.
     * Useful for post-processing or adding event listeners.
     * Receives undefined when content is empty.
     */
    onRender?: (element: HTMLElement | undefined) => void;
}
export declare const Markdown: any;
/**
 * A React hook for rendering markdown content.
 *
 * This hook integrates MarkdownRenderer with React's lifecycle,
 * ensuring that:
 * - Markdown is rendered only when content or renderer changes
 * - MarkdownRenderResult is properly disposed when component unmounts
 * - DOM elements are correctly managed by React
 * - Event listeners and other imperative DOM operations are preserved
 *
 * Returns a ref that should be attached to a DOM element.
 *
 * @example Basic usage
 * ```tsx
 * const MyComponent = ({ markdownRenderer }: { markdownRenderer: MarkdownRenderer }) => {
 *   const ref = useMarkdown('Hello **World**!', markdownRenderer, { supportHtml: true });
 *   return <div className="my-content" ref={ref} />;
 * };
 * ```
 *
 * @example With localized content
 * ```tsx
 * const MyComponent = ({ markdownRenderer }: { markdownRenderer: MarkdownRenderer }) => {
 *   const content = nls.localize('my.key', 'Hello **{0}**!', 'World');
 *   const ref = useMarkdown(content, markdownRenderer);
 *   return <div className="my-content" ref={ref} />;
 * };
 * ```
 */
export declare function useMarkdown(markdown: string | MarkdownString | undefined, markdownRenderer: MarkdownRenderer, markdownOptions?: MarkdownProps['markdownOptions'], onRender?: (element: HTMLElement | undefined) => void): React.RefObject<HTMLDivElement>;
export interface LocalizedMarkdownProps extends MarkdownProps {
    /**
     * The localization key for the markdown content.
     */
    localizationKey: string;
    /**
     * The default markdown content (in English) with placeholders.
     * Use {0}, {1}, etc. for parameter substitution.
     */
    defaultMarkdown: string;
    /**
     * Arguments to substitute into the markdown template.
     * Can be strings, numbers, booleans, or undefined.
     */
    args?: FormatType[];
}
/**
 * A React component that combines localization with markdown rendering.
 *
 * This component automatically handles the localization of markdown content using `nls.localize`
 * and then renders it using the Markdown component.
 *
 * @example Basic usage
 * ```tsx
 * <LocalizedMarkdown
 *   localizationKey="theia/mypackage/welcome"
 *   defaultMarkdown="Welcome to **Theia**!"
 *   markdownRenderer={this.markdownRenderer}
 *   className="welcome-message"
 * />
 * ```
 *
 * @example With parameters
 * ```tsx
 * <LocalizedMarkdown
 *   localizationKey="theia/mypackage/greeting"
 *   defaultMarkdown="Hello **{0}**! You have {1} new messages."
 *   args={['Alice', 5]}
 *   markdownRenderer={this.markdownRenderer}
 * />
 * ```
 *
 * @example With command links
 * ```tsx
 * <LocalizedMarkdown
 *   localizationKey="theia/mypackage/settings"
 *   defaultMarkdown="Open [settings]({0}) to configure."
 *   args={[`command:${CommonCommands.OPEN_PREFERENCES.id}`]}
 *   markdownRenderer={this.markdownRenderer}
 *   markdownOptions={{
 *     isTrusted: { enabledCommands: [CommonCommands.OPEN_PREFERENCES.id] }
 *   }}
 * />
 * ```
 */
export declare const LocalizedMarkdown: React.FC<LocalizedMarkdownProps>;
//# sourceMappingURL=markdown.d.ts.map