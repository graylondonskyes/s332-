import { MenuContribution, MenuModelRegistry, MenuPath } from '@theia/core';
export declare const EDITOR_CONTEXT_MENU: MenuPath;
/** Corresponds to `editor/content` contribution point in VS Code. */
export declare const EDITOR_CONTENT_MENU: MenuPath;
/**
 * Editor context menu default groups should be aligned
 * with VS Code default groups: https://code.visualstudio.com/api/references/contribution-points#contributes.menus
 */
export declare namespace EditorContextMenu {
    const NAVIGATION: any[];
    const MODIFICATION: any[];
    const CUT_COPY_PASTE: any[];
    const COMMANDS: any[];
    const UNDO_REDO: any[];
}
export declare namespace EditorMainMenu {
    /**
     * The main `Go` menu item.
     */
    const GO: any[];
    /**
     * Navigation menu group in the `Go` main-menu.
     */
    const NAVIGATION_GROUP: any[];
    /**
     * Context management group in the `Go` main menu: Pane and editor switching commands.
     */
    const CONTEXT_GROUP: any[];
    /**
     * Submenu for switching panes in the main area.
     */
    const PANE_GROUP: any[];
    const BY_NUMBER: any[];
    const NEXT_PREVIOUS: any[];
    /**
     * Workspace menu group in the `Go` main-menu.
     */
    const WORKSPACE_GROUP: any[];
    /**
     * Language features menu group in the `Go` main-menu.
     */
    const LANGUAGE_FEATURES_GROUP: any[];
    /**
     * Location menu group in the `Go` main-menu.
     */
    const LOCATION_GROUP: any[];
}
export declare class EditorMenuContribution implements MenuContribution {
    registerMenus(registry: MenuModelRegistry): void;
}
//# sourceMappingURL=editor-menu.d.ts.map