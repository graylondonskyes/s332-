import { ApplicationShell } from '../shell';
import { Widget } from './widget';
/**
 * A contract for widgets that are extractable to a secondary window.
 */
export interface ExtractableWidget extends Widget {
    /** Set to `true` to mark the widget to be extractable. */
    isExtractable: boolean;
    /** The secondary window that the window was extracted to or `undefined` if it is not yet extracted. */
    secondaryWindow: Window | undefined;
    /** Stores the area which contained the widget before being extracted. This is undefined if the widget wasn't extracted or if the area could not be determined */
    previousArea?: ApplicationShell.Area;
}
export declare namespace ExtractableWidget {
    function is(widget: unknown): widget is ExtractableWidget;
}
//# sourceMappingURL=extractable-widget.d.ts.map