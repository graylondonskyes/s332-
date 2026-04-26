import { JSONObject } from '@lumino/coreutils';
import URI from '../uri';
import { Emitter, Event } from '../event';
import { Deferred } from '../promise-util';
import { PreferenceScope } from './preference-scope';
import { PreferenceProvider, PreferenceProviderDataChange, PreferenceProviderDataChanges, PreferenceResolveResult } from './preference-provider';
import { DisposableCollection } from '../disposable';
export declare abstract class PreferenceProviderBase {
    protected readonly onDidPreferencesChangedEmitter: Emitter<PreferenceProviderDataChanges>;
    readonly onDidPreferencesChanged: Event<PreferenceProviderDataChanges>;
    protected readonly toDispose: DisposableCollection;
    protected deferredChanges: PreferenceProviderDataChanges | undefined;
    constructor();
    /**
     * Informs the listeners that one or more preferences of this provider are changed.
     * The listeners are able to find what was changed from the emitted event.
     */
    protected emitPreferencesChangedEvent(changes: PreferenceProviderDataChanges | PreferenceProviderDataChange[]): Promise<boolean>;
    protected mergePreferenceProviderDataChange(change: PreferenceProviderDataChange): void;
    protected fireDidPreferencesChanged: any;
    dispose(): void;
}
/**
 * The {@link PreferenceProvider} is used to store and retrieve preference values. A {@link PreferenceProvider} does not operate in a global scope but is
 * configured for one or more {@link PreferenceScope}s. The (default implementation for the) {@link PreferenceService} aggregates all {@link PreferenceProvider}s and
 * serves as a common facade for manipulating preference values.
 */
export declare abstract class PreferenceProviderImpl extends PreferenceProviderBase implements PreferenceProvider {
    protected readonly _ready: Deferred<void>;
    constructor();
    get<T>(preferenceName: string, resourceUri?: string): T | undefined;
    resolve<T>(preferenceName: string, resourceUri?: string): PreferenceResolveResult<T>;
    abstract getPreferences(resourceUri?: string): JSONObject;
    abstract setPreference(key: string, value: unknown, resourceUri?: string): Promise<boolean>;
    /**
     * Resolved when the preference provider is ready to provide preferences
     * It should be resolved by subclasses.
     */
    get ready(): Promise<void>;
    /**
     * Retrieve the domain for this provider.
     *
     * @returns the domain or `undefined` if this provider is suitable for all domains.
     */
    getDomain(): string[] | undefined;
    getConfigUri(resourceUri?: string, sectionName?: string): URI | undefined;
    getContainingConfigUri?(resourceUri?: string, sectionName?: string): URI | undefined;
    protected getParsedContent(jsonData: unknown): {
        [key: string]: unknown;
    };
    canHandleScope(scope: PreferenceScope): boolean;
}
//# sourceMappingURL=preference-provider-impl.d.ts.map