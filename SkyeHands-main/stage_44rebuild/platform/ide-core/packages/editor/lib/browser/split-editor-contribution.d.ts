import { Widget, DockLayout } from '@theia/core/lib/browser';
/**
 * Symbol used to bind SplitEditorContribution implementations.
 */
export declare const SplitEditorContribution: unique symbol;
/**
 * A contribution interface for handling split operations on different editor types.
 * Implementations should handle specific editor widget types (e.g., text editors, notebook editors).
 *
 * @template W the specific widget type this contribution handles
 */
export interface SplitEditorContribution<W extends Widget = Widget> {
    /**
     * Determines whether this contribution can handle the split operation for the given widget.
     * @param widget the widget to check
     * @returns a priority number (higher means higher priority), or 0 if this contribution cannot handle the widget
     */
    canHandle(widget: Widget): number;
    /**
     * Splits the given widget according to the specified split mode.
     * @param widget the widget to split
     * @param splitMode the direction in which to split
     * @returns the newly created widget, or undefined if the split operation failed
     */
    split(widget: W, splitMode: DockLayout.InsertMode): Promise<W | undefined>;
}
//# sourceMappingURL=split-editor-contribution.d.ts.map