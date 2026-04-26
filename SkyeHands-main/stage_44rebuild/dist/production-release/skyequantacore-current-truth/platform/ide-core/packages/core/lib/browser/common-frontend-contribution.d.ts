import { MenuContribution, MenuModelRegistry } from '../common/menu';
import { CommonMenus } from './common-menus';
export { CommonMenus };
import { KeybindingContribution, KeybindingRegistry } from './keybinding';
import { FrontendApplication } from './frontend-application';
import { FrontendApplicationContribution, OnWillStopAction } from './frontend-application-contribution';
import { CommandContribution, CommandRegistry } from '../common/command';
import { CommonCommands } from './common-commands';
export { CommonCommands };
import { SelectionService } from '../common/selection-service';
import { MessageService } from '../common/message-service';
import { OpenerService } from '../browser/opener-service';
import { ApplicationShell } from './shell/application-shell';
import { AboutDialog } from './about-dialog';
import { ContextKey, ContextKeyService } from './context-key-service';
import { ResourceContextKey } from './resource-context-key';
import { StorageService } from './storage-service';
import { IconThemeService } from './icon-theme-service';
import { ColorContribution } from './color-application-contribution';
import { ColorRegistry } from './color-registry';
import { CoreConfiguration, CorePreferences } from '../common/core-preferences';
import { ThemeService } from './theming';
import { ClipboardService } from './clipboard-service';
import { EncodingRegistry } from './encoding-registry';
import { EnvVariablesServer } from '../common/env-variables';
import { AuthenticationService } from './authentication-service';
import { SaveOptions } from './saveable';
import { QuickInputService } from './quick-input';
import { AsyncLocalizationProvider } from '../common/i18n/localization';
import { WindowService } from './window/window-service';
import { Title, Widget } from './widgets';
import { SaveableService } from './saveable-service';
import { UserWorkingDirectoryProvider } from './user-working-directory-provider';
import { PreferenceChangeEvent, PreferenceService, UntitledResourceResolver } from '../common';
import { LanguageQuickPickService } from './i18n/language-quick-pick-service';
import { UndoRedoHandlerService } from './undo-redo-handler';
export declare const supportCut: any;
export declare const supportCopy: any;
export declare const supportPaste: any;
export declare const RECENT_COMMANDS_STORAGE_KEY = "commands";
export declare const CLASSNAME_OS_MAC = "mac";
export declare const CLASSNAME_OS_WINDOWS = "windows";
export declare const CLASSNAME_OS_LINUX = "linux";
export declare class CommonFrontendContribution implements FrontendApplicationContribution, MenuContribution, CommandContribution, KeybindingContribution, ColorContribution {
    protected readonly shell: ApplicationShell;
    protected readonly selectionService: SelectionService;
    protected readonly messageService: MessageService;
    protected readonly openerService: OpenerService;
    protected readonly aboutDialog: AboutDialog;
    protected readonly localizationProvider: AsyncLocalizationProvider;
    protected readonly saveResourceService: SaveableService;
    protected commonDecorationsStyleSheet: CSSStyleSheet;
    constructor(shell: ApplicationShell, selectionService: SelectionService, messageService: MessageService, openerService: OpenerService, aboutDialog: AboutDialog, localizationProvider: AsyncLocalizationProvider, saveResourceService: SaveableService);
    protected readonly contextKeyService: ContextKeyService;
    protected readonly resourceContextKey: ResourceContextKey;
    protected readonly commandRegistry: CommandRegistry;
    protected readonly menuRegistry: MenuModelRegistry;
    protected readonly storageService: StorageService;
    protected readonly quickInputService: QuickInputService;
    protected readonly iconThemes: IconThemeService;
    protected readonly themeService: ThemeService;
    protected readonly preferences: CorePreferences;
    protected readonly preferenceService: PreferenceService;
    protected readonly clipboardService: ClipboardService;
    protected readonly encodingRegistry: EncodingRegistry;
    protected readonly environments: EnvVariablesServer;
    protected readonly authenticationService: AuthenticationService;
    protected readonly windowService: WindowService;
    protected readonly workingDirProvider: UserWorkingDirectoryProvider;
    protected readonly languageQuickPickService: LanguageQuickPickService;
    protected readonly untitledResourceResolver: UntitledResourceResolver;
    protected readonly undoRedoHandlerService: UndoRedoHandlerService;
    protected pinnedKey: ContextKey<boolean>;
    configure(app: FrontendApplication): Promise<void>;
    protected setOsClass(): void;
    protected updateStyles(): void;
    protected updatePinnedKey(): void;
    protected handlePreferenceChange(e: PreferenceChangeEvent<CoreConfiguration>, app: FrontendApplication): void;
    protected setSashProperties(): void;
    onStart(): void;
    protected setupHtmlLanguageAttributes(element: HTMLElement): void;
    onStop(): void;
    protected initResourceContextKeys(): void;
    registerMenus(registry: MenuModelRegistry): void;
    registerCommands(commandRegistry: CommandRegistry): void;
    protected getOrdinalNumbers(): readonly string[];
    protected isElectron(): boolean;
    protected togglePinned(title?: Title<Widget>): void;
    registerKeybindings(registry: KeybindingRegistry): void;
    protected save(options?: SaveOptions): Promise<void>;
    protected openAbout(): Promise<void>;
    protected shouldPreventClose: boolean;
    /**
     * registers event listener which make sure that
     * window doesn't get closed if CMD/CTRL W is pressed.
     * Too many users have that in their muscle memory.
     * Chrome doesn't let us rebind or prevent default the keybinding, so this
     * at least doesn't close the window immediately.
     */
    protected registerCtrlWHandling(): void;
    onWillStop(): OnWillStopAction | undefined;
    private confirmExitWithOrWithoutSaving;
    protected unsavedTabsCaptions(): string[];
    protected unsavedUntitledTabsCaptions(): Widget[];
    protected configureDisplayLanguage(): Promise<void>;
    /**
     * saves any dirty widget in toSave
     * side effect - will pop all widgets from toSave that was saved
     * @param toSave
     */
    protected saveDirty(toSave: Widget[]): Promise<void>;
    protected toggleBreadcrumbs(): void;
    protected isBreadcrumbsEnabled(): boolean;
    protected confirmRestart(languageName: string): Promise<boolean>;
    protected selectIconTheme(): void;
    protected selectColorTheme(): void;
    /**
     * @todo https://github.com/eclipse-theia/theia/issues/12824
     */
    protected showNewFilePicker(): Promise<void>;
    registerColors(colors: ColorRegistry): void;
}
//# sourceMappingURL=common-frontend-contribution.d.ts.map