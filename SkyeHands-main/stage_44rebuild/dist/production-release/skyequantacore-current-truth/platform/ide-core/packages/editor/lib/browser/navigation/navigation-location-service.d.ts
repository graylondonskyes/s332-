import { ILogger } from '@theia/core/lib/common/logger';
import { OpenerService, OpenerOptions } from '@theia/core/lib/browser/opener-service';
import { NavigationLocationUpdater } from './navigation-location-updater';
import { NavigationLocationSimilarity } from './navigation-location-similarity';
import { NavigationLocation, ContentChangeLocation, RecentlyClosedEditor } from './navigation-location';
import URI from '@theia/core/lib/common/uri';
/**
 * The navigation location service.
 * It also stores and manages navigation locations and recently closed editors.
 *
 * Since we update the navigation locations as a side effect of UI events (seting the selection, etc.) We sometimes
 * record intermediate locations which are not considered the "final" location we're navigating to.
 * In order to remedy, clients should always invoke "startNavigation" before registering locations and
 * invoke "endNavigation" when done. Only when no more nested navigations are active ist the last registered
 * location transfered to the navigation "stack".
 *
 */
export declare class NavigationLocationService {
    private static MAX_STACK_ITEMS;
    private static readonly MAX_RECENTLY_CLOSED_EDITORS;
    protected readonly logger: ILogger;
    protected readonly openerService: OpenerService;
    protected readonly updater: NavigationLocationUpdater;
    protected readonly similarity: NavigationLocationSimilarity;
    protected pointer: number;
    protected stack: NavigationLocation[];
    protected canRegister: boolean;
    protected _lastEditLocation: ContentChangeLocation | undefined;
    protected recentlyClosedEditors: RecentlyClosedEditor[];
    protected activeNavigations: {
        count: number;
        lastLocation: NavigationLocation[] | undefined;
    };
    /**
     * Start a logical navigation operation. Invoke this before invoking `registerLocations`
     */
    startNavigation(): void;
    /**
     * End a logical navigation operation. Invoke this before after `registerLocations`
     */
    endNavigation(): void;
    /**
     * Convenience method for executing a navigation operation with proper start and end navigation
     * @param navigation The operation changing the location
     * @returns the result of the navigation function
     */
    navigate<T>(navigation: (navigationServier: NavigationLocationService) => T): T;
    /**
     * Registers the give locations into the service.
     */
    register(...locations: NavigationLocation[]): void;
    protected doRegister(locations: NavigationLocation[]): void;
    /**
     * Navigates one back. Returns with the previous location, or `undefined` if it could not navigate back.
     */
    back(): Promise<NavigationLocation | undefined>;
    /**
     * Navigates one forward. Returns with the next location, or `undefined` if it could not go forward.
     */
    forward(): Promise<NavigationLocation | undefined>;
    /**
     * Checks whether the service can go [`back`](#back).
     */
    canGoBack(): boolean;
    /**
     * Checks whether the service can go [`forward`](#forward).
     */
    canGoForward(): boolean;
    /**
     * Returns with all known navigation locations in chronological order.
     */
    locations(): ReadonlyArray<NavigationLocation>;
    /**
     * Returns with the current location.
     */
    currentLocation(): NavigationLocation | undefined;
    /**
     * Returns with the location of the most recent edition if any. If there were no modifications,
     * returns `undefined`.
     */
    lastEditLocation(): NavigationLocation | undefined;
    /**
     * Clears the total history.
     */
    clearHistory(): void;
    /**
     * Reveals the location argument. If not given, reveals the `current location`. Does nothing, if the argument is `undefined`.
     */
    reveal(location?: NavigationLocation | undefined): Promise<void>;
    /**
     * `true` if the two locations are similar.
     */
    protected isSimilar(left: NavigationLocation | undefined, right: NavigationLocation | undefined): boolean;
    /**
     * Returns with the number of navigation locations that the application can handle and manage.
     * When the number of locations exceeds this number, old locations will be erased.
     */
    protected maxStackItems(): number;
    /**
     * Returns with the opener option for the location argument.
     */
    protected toOpenerOptions(location: NavigationLocation): OpenerOptions;
    private debug;
    private get stackDump();
    /**
     * Get the recently closed editors stack in chronological order.
     *
     * @returns readonly closed editors stack.
     */
    get closedEditorsStack(): ReadonlyArray<RecentlyClosedEditor>;
    /**
     * Get the last recently closed editor.
     *
     * @returns the recently closed editor if it exists.
     */
    getLastClosedEditor(): RecentlyClosedEditor | undefined;
    /**
     * Add the recently closed editor to the history.
     *
     * @param editor the recently closed editor.
     */
    addClosedEditor(editor: RecentlyClosedEditor): void;
    /**
     * Remove all occurrences of the given editor in the history if they exist.
     *
     * @param uri the uri of the editor that should be removed from the history.
     */
    removeClosedEditor(uri: URI): void;
    storeState(): object;
    restoreState(rawState: object): void;
}
//# sourceMappingURL=navigation-location-service.d.ts.map