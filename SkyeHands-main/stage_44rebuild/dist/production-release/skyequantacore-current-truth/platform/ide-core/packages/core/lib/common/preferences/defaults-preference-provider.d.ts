import { JSONObject, JSONValue } from '@lumino/coreutils';
import { PreferenceScope } from './preference-scope';
import { PreferenceProvider, PreferenceProviderDataChange, PreferenceResolveResult } from './preference-provider';
import { PreferenceSchemaService } from './preference-schema';
import { Deferred } from '../promise-util';
import { PreferenceLanguageOverrideService } from './preference-language-override-service';
import { PreferenceProviderBase } from './preference-provider-impl';
export declare class DefaultsPreferenceProvider extends PreferenceProviderBase implements PreferenceProvider {
    protected readonly preferenceSchemaService: PreferenceSchemaService;
    protected readonly preferenceOverrideService: PreferenceLanguageOverrideService;
    protected readonly _ready: Deferred<void>;
    ready: Promise<void>;
    init(): void;
    protected changeFor(key: string, overrideIdentifier: string | undefined, oldValue: JSONValue | undefined, newValue: JSONValue | undefined): PreferenceProviderDataChange;
    canHandleScope(scope: PreferenceScope): boolean;
    get<T>(preferenceName: string, resourceUri?: string): T | undefined;
    setPreference(key: string, value: JSONValue, resourceUri?: string): Promise<boolean>;
    resolve<T>(preferenceName: string, resourceUri?: string): PreferenceResolveResult<T>;
    getPreferences(): JSONObject;
}
//# sourceMappingURL=defaults-preference-provider.d.ts.map