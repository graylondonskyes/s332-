import { Command } from '../common/command';
export declare namespace CommonCommands {
    const FILE_CATEGORY = "File";
    const VIEW_CATEGORY = "View";
    const CREATE_CATEGORY = "Create";
    const PREFERENCES_CATEGORY = "Preferences";
    const MANAGE_CATEGORY = "Manage";
    const FILE_CATEGORY_KEY: string;
    const VIEW_CATEGORY_KEY: string;
    const PREFERENCES_CATEGORY_KEY: string;
    const OPEN: Command;
    const CUT: Command;
    const COPY: Command;
    const PASTE: Command;
    const COPY_PATH: Command;
    const UNDO: Command;
    const REDO: Command;
    const SELECT_ALL: Command;
    const FIND: Command;
    const REPLACE: Command;
    const NEXT_TAB: Command;
    const PREVIOUS_TAB: Command;
    const NEXT_TAB_IN_GROUP: Command;
    const PREVIOUS_TAB_IN_GROUP: Command;
    const NEXT_TAB_GROUP: Command;
    const PREVIOUS_TAB_GROUP: Command;
    const CLOSE_TAB: Command;
    const CLOSE_OTHER_TABS: Command;
    const CLOSE_SAVED_TABS: Command;
    const CLOSE_RIGHT_TABS: Command;
    const CLOSE_ALL_TABS: Command;
    const CLOSE_MAIN_TAB: Command;
    const CLOSE_OTHER_MAIN_TABS: Command;
    const CLOSE_ALL_MAIN_TABS: Command;
    const COLLAPSE_PANEL: Command;
    const COLLAPSE_ALL_PANELS: Command;
    const TOGGLE_BOTTOM_PANEL: Command;
    const TOGGLE_LEFT_PANEL: Command;
    const TOGGLE_RIGHT_PANEL: Command;
    const TOGGLE_STATUS_BAR: Command;
    const PIN_TAB: Command;
    const UNPIN_TAB: Command;
    const TOGGLE_MAXIMIZED: Command;
    const OPEN_VIEW: Command;
    const SHOW_MENU_BAR: Command;
    /**
     * Command Parameters:
     * - `fileName`: string
     * - `directory`: URI
     */
    const NEW_FILE: Command;
    const NEW_UNTITLED_TEXT_FILE: Command;
    const PICK_NEW_FILE: Command;
    const SAVE: Command;
    const SAVE_AS: Command;
    const SAVE_WITHOUT_FORMATTING: Command;
    const SAVE_ALL: Command;
    const AUTO_SAVE: Command;
    const ABOUT_COMMAND: Command;
    const OPEN_PREFERENCES: Command;
    const SELECT_COLOR_THEME: Command;
    const SELECT_ICON_THEME: Command;
    const CONFIGURE_DISPLAY_LANGUAGE: Command;
    const TOGGLE_BREADCRUMBS: Command;
}
//# sourceMappingURL=common-commands.d.ts.map