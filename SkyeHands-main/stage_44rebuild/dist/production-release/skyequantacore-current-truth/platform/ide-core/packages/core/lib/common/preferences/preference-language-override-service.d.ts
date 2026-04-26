import { IndexedAccess, PreferenceSchemaService } from './preference-schema';
import { JSONValue } from '@lumino/coreutils';
export interface OverridePreferenceName {
    preferenceName: string;
    overrideIdentifier: string;
}
export declare namespace OverridePreferenceName {
    function is(arg: unknown): arg is OverridePreferenceName;
}
export declare const OVERRIDE_PROPERTY_PATTERN: RegExp;
export declare const getOverridePattern: (identifier: string) => string;
export declare class PreferenceLanguageOverrideService {
    protected readonly preferenceSchemaService: PreferenceSchemaService;
    static testOverrideValue(name: string, value: unknown): value is IndexedAccess<JSONValue>;
    /**
     * @param overrideIdentifier the language id associated for a language override, e.g. `typescript`
     * @returns the form used to mark language overrides in preference files, e.g. `[typescript]`
     */
    markLanguageOverride(overrideIdentifier: string): string;
    /**
     * @returns the flat JSON path to an overridden preference, e.g. [typescript].editor.tabSize.
     */
    overridePreferenceName({ preferenceName, overrideIdentifier }: OverridePreferenceName): string;
    /**
     * @returns an OverridePreferenceName if the `name` contains a language override, e.g. [typescript].editor.tabSize.
     */
    overriddenPreferenceName(name: string): OverridePreferenceName | undefined;
    computeOverridePatternPropertiesKey(): string | undefined;
    getOverridePreferenceNames(preferenceName: string): IterableIterator<string>;
}
//# sourceMappingURL=preference-language-override-service.d.ts.map