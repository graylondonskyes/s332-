/**
 * Checks whether the given target URL should bypass the proxy based on `no_proxy` rules.
 *
 * @param targetUrl - The URL to check against the no_proxy rules.
 * @param noProxyValue - A comma-separated list of no_proxy rules.
 * @returns `true` if the target URL should bypass the proxy, `false` otherwise.
 */
export declare function shouldBypassProxy(targetUrl: string | undefined, noProxyValue: string | undefined): boolean;
//# sourceMappingURL=proxy-util.d.ts.map