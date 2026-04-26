import { interfaces } from 'inversify';
/**
 * This utility creates a factory function that accepts runtime arguments which are bound as constant
 * values in a child container, allowing for dependency injection of both static dependencies
 * (resolved as usual from the factory's container) and dynamic parameters (provided at factory invocation time).
 *
 * @example
 * ```typescript
 * // Factory interface
 * interface UserPreferenceProviderFactory {
 *     (uri: URI, section: string): UserPreferenceProvider;
 * }
 * // Factory symbol
 * const UserPreferenceProviderFactory = Symbol('UserPreferenceProviderFactory');
 *
 * // Bind the factory
 * bindFactory(
 *     bind,
 *     UserPreferenceProviderFactory,   // Service identifier of the factory
 *     UserPreferenceProvider,          // Service identifier of the entity to be constructed
 *     SectionPreferenceProviderUri,    // The first factory argument will be bound to this identifier (uri)
 *     SectionPreferenceProviderSection // The second factory argument will be bound to this identifier  (section)
 * );
 *
 * // Usage: factory(uri, section) creates UserPreferenceProvider with injected dependencies
 * const factory = container.get(UserPreferenceProviderFactory);
 * const provider = factory(myUri, 'settings');
 * ```
 */
export declare function bindFactory<F, C>(bind: interfaces.Bind, factoryId: interfaces.ServiceIdentifier<F>, constructor: interfaces.Newable<C>, ...parameterBindings: interfaces.ServiceIdentifier<unknown>[]): void;
//# sourceMappingURL=inversify-utils.d.ts.map