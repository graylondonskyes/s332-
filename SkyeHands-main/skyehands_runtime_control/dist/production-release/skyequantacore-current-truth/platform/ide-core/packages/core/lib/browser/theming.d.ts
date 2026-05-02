import { Disposable } from '../common/disposable';
import { Emitter, Event } from '../common/event';
import { PreferenceSchemaService } from '../common/preferences/preference-schema';
import { Deferred } from '../common/promise-util';
import { Theme, ThemeChangeEvent } from '../common/theme';
import { PreferenceService } from '../common/preferences';
export declare class ThemeService {
    static readonly STORAGE_KEY = "theme";
    protected readonly preferences: PreferenceService;
    protected readonly schemaProvider: PreferenceSchemaService;
    protected themes: {
        [id: string]: Theme;
    };
    protected activeTheme: Theme;
    protected readonly themeChange: Emitter<ThemeChangeEvent>;
    protected readonly deferredInitializer: Deferred<void>;
    get initialized(): Promise<void>;
    readonly onDidColorThemeChange: Event<ThemeChangeEvent>;
    protected init(): void;
    register(...themes: Theme[]): Disposable;
    protected validateActiveTheme(): void;
    protected updateColorThemePreference: any;
    protected doUpdateColorThemePreference(): void;
    getThemes(): Theme[];
    getTheme(themeId: string): Theme;
    protected tryGetTheme(themeId: string): Theme | undefined;
    /** Should only be called at startup. */
    loadUserTheme(): void;
    /**
     * @param persist If `true`, the value of the `workbench.colorTheme` preference will be set to the provided ID.
     */
    setCurrentTheme(themeId: string, persist?: boolean): void;
    getCurrentTheme(): Theme;
    protected getConfiguredTheme(): Theme | undefined;
    /**
     * The default theme. If that is not applicable, returns with the fallback theme.
     */
    get defaultTheme(): Theme;
    /**
     * Resets the state to the user's default, or to the fallback theme. Also discards any persisted state in the local storage.
     */
    reset(): void;
}
export declare class BuiltinThemeProvider {
    static readonly darkTheme: Theme;
    static readonly lightTheme: Theme;
    static readonly hcTheme: Theme;
    static readonly hcLightTheme: Theme;
    static readonly themes: Theme[];
}
//# sourceMappingURL=theming.d.ts.map