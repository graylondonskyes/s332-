import * as React from 'react';
import { Event } from '../../../common';
import { Widget } from '../../widgets';
import { MenuPath } from '../../../common/menu';
/** Items whose group is exactly 'navigation' will be rendered inline. */
export declare const NAVIGATION = "navigation";
export declare const TAB_BAR_TOOLBAR_CONTEXT_MENU: string[];
export interface TabBarDelegator extends Widget {
    getTabBarDelegate(): Widget | undefined;
}
export declare namespace TabBarDelegator {
    function is(candidate?: Widget): candidate is TabBarDelegator;
}
export type TabBarToolbarAction = RenderedToolbarAction | ReactTabBarToolbarAction;
/**
 * Representation of an item in the tab
 */
export interface TabBarToolbarActionBase {
    /**
     * The unique ID of the toolbar item.
     */
    id: string;
    /**
     * The command to execute when the item is selected.
     */
    command?: string;
    /**
     * https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
     */
    when?: string;
    /**
     * Checked before the item is shown.
     */
    isVisible?(widget?: Widget): boolean;
    /**
     * When defined, the container tool-bar will be updated if this event is fired.
     *
     * Note: currently, each item of the container toolbar will be re-rendered if any of the items have changed.
     */
    onDidChange?: Event<void>;
    /**
     * Priority among the items. Can be negative. The smaller the number the left-most the item will be placed in the toolbar. It is `0` by default.
     */
    priority?: number;
    group?: string;
    /**
     * A menu path with which this item is associated.
     */
    menuPath?: MenuPath;
    /**
     * Optional ordering string for placing the item within its group
     */
    order?: string;
}
export interface RenderedToolbarAction extends TabBarToolbarActionBase {
    /**
     * Optional icon for the item.
     */
    icon?: string | (() => string);
    /**
     * Optional text of the item.
     *
     * Strings in the format `$(iconIdentifier~animationType) will be treated as icon references.
     * If the iconIdentifier begins with fa-, Font Awesome icons will be used; otherwise it will be treated as Codicon name.
     *
     * You can find Codicon classnames here: https://microsoft.github.io/vscode-codicons/dist/codicon.html
     * You can find Font Awesome classnames here: http://fontawesome.io/icons/
     * The type of animation can be either `spin` or `pulse`.
     */
    text?: string;
    /**
     * Optional tooltip for the item.
     */
    tooltip?: string;
}
/**
 * Tab-bar toolbar item backed by a `React.ReactNode`.
 * Unlike the `TabBarToolbarAction`, this item is not connected to the command service.
 */
export interface ReactTabBarToolbarAction extends TabBarToolbarActionBase {
    render(widget?: Widget): React.ReactNode;
}
export declare namespace ReactTabBarToolbarAction {
    function is(item: TabBarToolbarAction): item is ReactTabBarToolbarAction;
}
export declare namespace TabBarToolbarAction {
    /**
     * Compares the items by `priority` in ascending. Undefined priorities will be treated as `0`.
     */
    const PRIORITY_COMPARATOR: (left: {
        group?: string;
        priority?: number;
    }, right: {
        group?: string;
        priority?: number;
    }) => number;
}
//# sourceMappingURL=tab-bar-toolbar-types.d.ts.map