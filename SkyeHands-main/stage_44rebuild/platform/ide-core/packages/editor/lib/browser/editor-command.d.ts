import { LabelProvider, ApplicationShell, QuickInputService, SaveableService } from '@theia/core/lib/browser';
import { EditorManager } from './editor-manager';
import { CommandContribution, CommandRegistry, Command, ResourceProvider, MessageService } from '@theia/core';
import { LanguageService } from '@theia/core/lib/browser/language-service';
import { EditorLanguageQuickPickService } from './editor-language-quick-pick-service';
import { PreferenceService } from '@theia/core/lib/common/preferences';
export declare namespace EditorCommands {
    const GOTO_LINE_COLUMN: any;
    /**
     * Show editor references
     */
    const SHOW_REFERENCES: Command;
    /**
     * Change indentation configuration (i.e., indent using tabs / spaces, and how many spaces per tab)
     */
    const CONFIG_INDENTATION: Command;
    const CONFIG_EOL: any;
    const INDENT_USING_SPACES: any;
    const INDENT_USING_TABS: any;
    const CHANGE_LANGUAGE: any;
    const CHANGE_ENCODING: any;
    const REVERT_EDITOR: any;
    const REVERT_AND_CLOSE: any;
    /**
     * Command for going back to the last editor navigation location.
     */
    const GO_BACK: any;
    /**
     * Command for going to the forthcoming editor navigation location.
     */
    const GO_FORWARD: any;
    /**
     * Command that reveals the last text edit location, if any.
     */
    const GO_LAST_EDIT: any;
    /**
     * Command that clears the editor navigation history.
     */
    const CLEAR_EDITOR_HISTORY: any;
    /**
     * Command that displays all editors that are currently opened.
     */
    const SHOW_ALL_OPENED_EDITORS: any;
    /**
     * Command that toggles the minimap.
     */
    const TOGGLE_MINIMAP: any;
    /**
     * Command that toggles the rendering of whitespace characters in the editor.
     */
    const TOGGLE_RENDER_WHITESPACE: any;
    /**
     * Command that toggles the word wrap.
     */
    const TOGGLE_WORD_WRAP: any;
    /**
     * Command that toggles sticky scroll.
     */
    const TOGGLE_STICKY_SCROLL: any;
    /**
     * Command that re-opens the last closed editor.
     */
    const REOPEN_CLOSED_EDITOR: any;
    /**
     * Opens a second instance of the current editor, splitting the view in the direction specified.
     */
    const SPLIT_EDITOR_RIGHT: any;
    const SPLIT_EDITOR_DOWN: any;
    const SPLIT_EDITOR_UP: any;
    const SPLIT_EDITOR_LEFT: any;
    /**
     * Default horizontal split: right.
     */
    const SPLIT_EDITOR_HORIZONTAL: any;
    /**
     * Default vertical split: down.
     */
    const SPLIT_EDITOR_VERTICAL: any;
}
export declare class EditorCommandContribution implements CommandContribution {
    static readonly AUTOSAVE_PREFERENCE: string;
    static readonly AUTOSAVE_DELAY_PREFERENCE: string;
    static readonly AUTOSAVE_WHEN_NO_ERRORS_PREFERENCE: string;
    protected readonly shell: ApplicationShell;
    protected readonly preferencesService: PreferenceService;
    protected readonly saveResourceService: SaveableService;
    protected readonly quickInputService: QuickInputService;
    protected readonly messageService: MessageService;
    protected readonly labelProvider: LabelProvider;
    protected readonly languages: LanguageService;
    protected readonly editorManager: EditorManager;
    protected readonly resourceProvider: ResourceProvider;
    protected readonly codeLanguageQuickPickService: EditorLanguageQuickPickService;
    protected init(): void;
    registerCommands(registry: CommandRegistry): void;
    protected canConfigureLanguage(): boolean;
    protected configureLanguage(): Promise<void>;
    protected canConfigureEncoding(): boolean;
    protected configureEncoding(): Promise<void>;
    protected isAutoSaveOn(): boolean;
    protected toggleAutoSave(): Promise<void>;
}
//# sourceMappingURL=editor-command.d.ts.map