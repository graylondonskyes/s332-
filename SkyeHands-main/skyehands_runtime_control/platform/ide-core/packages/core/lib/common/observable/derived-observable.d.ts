import { BaseObservable, Observable } from './observable-base';
/**
 * An observable that is derived from other observables.
 * Its value is only (re-)computed when absolutely needed.
 */
export declare class DerivedObservable<T, TChangeSummary = unknown> extends BaseObservable<T> {
    protected readonly compute: (args: DerivedObservable.Args<TChangeSummary>) => T;
    protected state: DerivedObservable.State;
    protected value?: T;
    protected updateCount: number;
    protected isComputing: boolean;
    protected dependencies: Set<Observable<unknown, unknown>>;
    protected dependenciesToBeRemoved?: Set<Observable<unknown>>;
    protected removedObserversToCallEndUpdateOn?: Set<Observable.Observer>;
    protected readonly dependencyObserver: Observable.Observer;
    protected readonly isEqual: (a: T, b: T) => boolean;
    protected readonly createChangeSummary?: () => TChangeSummary;
    protected readonly willHandleChange?: <U, UChange>(context: Observable.ChangeContext<U, UChange>, changeSummary: TChangeSummary | undefined) => boolean;
    protected changeSummary?: TChangeSummary;
    constructor(compute: (args: DerivedObservable.Args<TChangeSummary>) => T, options?: DerivedObservable.Options<T, TChangeSummary>);
    protected onLastObserverRemoved(): void;
    protected getValue(): T;
    protected recompute(): void;
    protected watchDependency<U>(dependency: Observable<U>): U;
    protected createDependencyObserver(): Observable.Observer;
    addObserver(observer: Observable.Observer): void;
    removeObserver(observer: Observable.Observer): void;
}
export declare namespace DerivedObservable {
    function create<T, TChangeSummary>(compute: (args: Args<TChangeSummary>) => T, options?: Options<T, TChangeSummary>): Observable<T, void>;
    interface Args<TChangeSummary> {
        /**
         * The change summary with the changes collected from the start of the previous run of the compute function until the start of this run.
         *
         * The change summary is created by {@link Options.createChangeSummary} and
         * the changes are collected by {@link Options.willHandleChange}.
         */
        readonly changeSummary: TChangeSummary | undefined;
    }
    interface Options<T, TChangeSummary> {
        isEqual?: (a: T, b: T) => boolean;
        /**
         * Creates a change summary that can collect the changes reported by the observed dependencies to {@link willHandleChange}.
         */
        createChangeSummary?: () => TChangeSummary;
        /**
         * Handles a change reported by an observed dependency, e.g. by adding it to the {@link changeSummary}.
         * Returns `true` if the reported change should be reacted to, and `false` if it should be ignored.
         */
        willHandleChange?: <U, UChange>(context: Observable.ChangeContext<U, UChange>, changeSummary: TChangeSummary | undefined) => boolean;
    }
    const enum State {
        /**
         * Initial state. No cached value.
         */
        Initial = 0,
        /**
         * Dependencies might have changed. Need to check if at least one dependency has actually changed.
         */
        DependenciesMightHaveChanged = 1,
        /**
         * A dependency has changed. Need to recompute the cached value.
         */
        Stale = 2,
        /**
         * The cached value is up to date.
         */
        UpToDate = 3
    }
}
//# sourceMappingURL=derived-observable.d.ts.map