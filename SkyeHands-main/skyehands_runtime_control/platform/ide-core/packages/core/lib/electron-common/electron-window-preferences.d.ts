import { interfaces } from 'inversify';
import { PreferenceSchema } from '../common/preferences/preference-schema';
import { PreferenceProxy, PreferenceService } from '../common/preferences';
export declare namespace ZoomLevel {
    const DEFAULT = 0;
    const MIN = -8;
    const MAX = 9;
    const VARIATION = 0.5;
    const ZOOM_BASE = 1.2;
}
export declare const PREF_WINDOW_ZOOM_LEVEL = "window.zoomLevel";
export declare const PREF_WINDOW_TITLE_BAR_STYLE = "window.titleBarStyle";
export declare const electronWindowPreferencesSchema: PreferenceSchema;
export declare class ElectronWindowConfiguration {
    [PREF_WINDOW_ZOOM_LEVEL]: number;
    [PREF_WINDOW_TITLE_BAR_STYLE]: 'native' | 'custom';
}
export declare const ElectronWindowPreferenceContribution: unique symbol;
export declare const ElectronWindowPreferences: unique symbol;
export type ElectronWindowPreferences = PreferenceProxy<ElectronWindowConfiguration>;
export declare function createElectronWindowPreferences(preferences: PreferenceService, schema?: PreferenceSchema): ElectronWindowPreferences;
export declare function bindWindowPreferences(bind: interfaces.Bind): void;
//# sourceMappingURL=electron-window-preferences.d.ts.map