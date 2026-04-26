/**
 * An array of preference scopes that are valid in a given context, sorted from more general to more specific
 */
export declare const ValidPreferenceScopes: unique symbol;
export declare enum PreferenceScope {
    Default = 0,
    User = 1,
    Workspace = 2,
    Folder = 3
}
export declare namespace PreferenceScope {
    function is(scope: unknown): scope is PreferenceScope;
    /**
     * @returns preference scopes from broadest to narrowest: Default -> Folder.
     */
    function getScopes(): PreferenceScope[];
    /**
     * @returns preference scopes from narrowest to broadest. Folder -> Default.
     */
    function getReversedScopes(): PreferenceScope[];
    function getScopeNames(scope?: PreferenceScope): string[];
}
//# sourceMappingURL=preference-scope.d.ts.map