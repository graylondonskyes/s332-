import { interfaces } from 'inversify';
import { PreferenceProviderImpl, PreferenceScope } from '../../../common/preferences';
export declare class MockPreferenceProvider extends PreferenceProviderImpl {
    protected scope: PreferenceScope;
    readonly prefs: {
        [p: string]: any;
    };
    constructor(scope: PreferenceScope);
    markReady(): void;
    getPreferences(): {
        [p: string]: any;
    };
    setPreference(preferenceName: string, newValue: any, resourceUri?: string): Promise<boolean>;
}
export declare function bindMockPreferenceProviders(bind: interfaces.Bind, unbind: interfaces.Unbind): void;
//# sourceMappingURL=mock-preference-provider.d.ts.map