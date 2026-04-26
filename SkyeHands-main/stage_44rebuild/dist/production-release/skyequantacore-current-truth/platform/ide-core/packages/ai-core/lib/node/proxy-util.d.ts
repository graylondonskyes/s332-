/**
 * Creates a custom fetch function that routes requests through the given HTTP proxy.
 * Returns `undefined` if no proxy URL is provided.
 *
 * @param proxyUrl - The proxy URL to use, or `undefined` for no proxy.
 * @returns A custom fetch function using the proxy, or `undefined`.
 */
export declare function createProxyFetch(proxyUrl: string | undefined): typeof fetch | undefined;
/**
 * Resolves the proxy URL to use for a given target URL.
 *
 * Resolution order:
 * 1. If `settingsProxy` is provided (e.g., from Theia `http.proxy` preference), use it.
 * 2. Otherwise check environment variables based on the target URL scheme.
 * 3. If a proxy is resolved, check `no_proxy`/`NO_PROXY` — if bypass, return `undefined`.
 * 4. Return the resolved proxy URL or `undefined` if none found.
 *
 * @param targetUrl - The URL for which to resolve a proxy.
 * @param settingsProxy - An optional proxy URL from application settings.
 * @returns The proxy URL to use, or `undefined` if no proxy should be used.
 */
export declare function getProxyUrl(targetUrl: string | undefined, settingsProxy?: string): string | undefined;
//# sourceMappingURL=proxy-util.d.ts.map