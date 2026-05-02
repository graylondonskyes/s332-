import { interfaces } from 'inversify';
export declare const ContributionProvider: unique symbol;
export interface ContributionProvider<T extends object> {
    /**
     * @param recursive `true` if the contributions should be collected from the parent containers as well. Otherwise, `false`. It is `false` by default.
     */
    getContributions(recursive?: boolean): T[];
}
export type Bindable = interfaces.Bind | interfaces.Container;
export declare namespace Bindable {
    function isContainer(arg: Bindable): arg is interfaces.Container;
}
/**
 * Binds a {@link ContributionProvider} for the given service identifier.
 *
 * **In most cases, prefer {@link bindRootContributionProvider} instead.** This variant retains a reference
 * to whichever container first resolves the provider. If that container is a short-lived child (e.g. a widget
 * container), the provider will keep the child — and everything cached in it — alive for the lifetime of the
 * application, causing a memory leak.
 *
 * Use `bindContributionProvider` only when you are certain that some or all of the relevant services are
 * scoped to a child container rather than the root container — for example, inside a
 * {@link ConnectionContainerModule} (connection-scoped child containers).
 *
 * @param bindable - A `Container` or `Bind` function to register the provider in.
 * @param id - The service identifier symbol whose contributions the provider collects.
 */
export declare function bindContributionProvider(bindable: Bindable, id: symbol): void;
/**
 * Binds a {@link ContributionProvider} for the given service identifier, resolving contributions
 * from the **root** (top-level) Inversify container.
 *
 * **This is the recommended default** for binding contribution providers in module-level `ContainerModule`
 * definitions. It walks up from whichever container first resolves the provider to the root container,
 * ensuring the provider does not permanently retain a reference to a short-lived child container.
 *
 * Use this function when contributions are registered at the application level (the common case for
 * `FrontendApplicationContribution`, `CommandContribution`, `MenuContribution`, `KeybindingContribution`,
 * and similar top-level contribution points).
 *
 * If you need contributions that are scoped to a child container (e.g. connection-scoped), use {@link bindContributionProvider} instead.
 *
 * See {@link https://github.com/eclipse-theia/theia/issues/10877#issuecomment-1107000223}
 *
 * @param bindable - A `Container` or `Bind` function to register the provider in.
 * @param id - The service identifier symbol whose contributions the provider collects.
 */
export declare function bindRootContributionProvider(bindable: Bindable, id: symbol): void;
/**
 * Helper function to bind a service to a list of contributions easily.
 * @param bindable a Container or the bind function directly.
 * @param service an already bound service to refer the contributions to.
 * @param contributions array of contribution identifiers to bind the service to.
 */
export declare function bindContribution(bindable: Bindable, service: interfaces.ServiceIdentifier<any>, contributions: interfaces.ServiceIdentifier<any>[]): void;
//# sourceMappingURL=contribution-provider.d.ts.map