import { URI } from 'vscode-uri';
export type ThemeType = 'light' | 'dark' | 'hc' | 'hcLight';
export type ThemeMode = 'light' | 'dark';
export interface Theme {
    readonly id: string;
    readonly type: ThemeType;
    readonly label: string;
    readonly description?: string;
    readonly editorTheme?: string;
    activate?(): void;
    deactivate?(): void;
}
export declare function isHighContrast(scheme: ThemeType): boolean;
export declare function getThemeMode(type: ThemeType): ThemeMode;
export interface ThemeChangeEvent {
    readonly newTheme: Theme;
    readonly oldTheme?: Theme;
}
export interface ThemeColor {
    readonly id: string;
}
export declare function isThemeColor(obj: unknown): obj is ThemeColor;
export interface ThemeIcon {
    readonly id: string;
    readonly color?: ThemeColor;
}
export declare function isThemeIcon(obj: unknown): obj is ThemeIcon;
export interface IconDefinition {
    font?: IconFontContribution;
    fontCharacter: string;
}
export interface IconFontContribution {
    readonly id: string;
    readonly definition: IconFontDefinition;
}
export interface IconFontDefinition {
    readonly weight?: string;
    readonly style?: string;
    readonly src: IconFontSource[];
}
export interface IconFontSource {
    readonly location: URI;
    readonly format: string;
}
//# sourceMappingURL=theme.d.ts.map