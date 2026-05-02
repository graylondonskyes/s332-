import { Disposable } from '../disposable';
import { Observable } from './observable-base';
export declare class Autorun<TChangeSummary = unknown> implements Disposable {
    protected readonly doRun: (args: Autorun.Args<TChangeSummary>) => void;
    protected state: Autorun.State;
    protected updateCount: number;
    protected disposed: boolean;
    protected isRunning: boolean;
    protected dependencies: Set<Observable<unknown, unknown>>;
    protected dependenciesToBeRemoved?: Set<Observable<unknown>>;
    protected readonly dependencyObserver: Observable.Observer;
    protected readonly createChangeSummary?: () => TChangeSummary;
    protected readonly willHandleChange?: <T, TChange>(context: Observable.ChangeContext<T, TChange>, changeSummary: TChangeSummary | undefined) => boolean;
    protected changeSummary?: TChangeSummary;
    constructor(doRun: (args: Autorun.Args<TChangeSummary>) => void, options?: Autorun.Options<TChangeSummary>);
    dispose(): void;
    protected run(isFirstRun?: boolean): void;
    protected watchDependency<T>(dependency: Observable<T>): T;
    protected createDependencyObserver(): Observable.Observer;
}
export declare namespace Autorun {
    /**
     * Runs the given {@link run} function immediately, and whenever an update scope ends
     * and an observable tracked as a dependency of the autorun has changed.
     *
     * Note that the run function of the autorun is called within an invocation context where
     * the {@link Observable.Accessor.getCurrent current accessor} is set to track the autorun
     * dependencies, so that any observables accessed with `get()` will automatically be tracked.
     * Occasionally, it might be useful to disable such automatic tracking and track the dependencies
     * manually with `get(accessor)`. This can be done using the {@link Observable.noAutoTracking} function,
     * e.g.
     * ```ts
     * this.toDispose.push(Autorun.create(() => Observable.noAutoTracking(accessor => {
     *    const value1 = this.observable1.get(accessor); // the autorun will depend on this observable...
     *    const value2 = this.observable2.get(); // ...but not on this observable
     * })));
     * ```
     * In particular, this pattern might be useful when copying existing autorun code from VS Code,
     * where observables can only be tracked manually with `read(reader)`, which corresponds to
     * `get(accessor)` in Theia; calls to `get()` never cause an observable to be tracked. This directly
     * corresponds to disabling automatic tracking in Theia with {@link Observable.noAutoTracking}.
     */
    function create<TChangeSummary = void>(run: (args: Args<TChangeSummary>) => void, options?: Options<TChangeSummary>): Disposable;
    interface Args<TChangeSummary> {
        readonly autorun: Disposable;
        readonly isFirstRun: boolean;
        /**
         * The change summary with the changes collected from the start of the previous run of the autorun until the start of this run.
         *
         * The change summary is created by {@link Options.createChangeSummary} and
         * the changes are collected by {@link Options.willHandleChange}.
         */
        readonly changeSummary: TChangeSummary | undefined;
    }
    interface Options<TChangeSummary> {
        /**
         * Creates a change summary that can collect the changes reported by the observed dependencies to {@link willHandleChange}.
         */
        createChangeSummary?: () => TChangeSummary;
        /**
         * Handles a change reported by an observed dependency, e.g. by adding it to the {@link changeSummary}.
         * Returns `true` if the reported change should be reacted to, and `false` if it should be ignored.
         */
        willHandleChange?: <T, TChange>(context: Observable.ChangeContext<T, TChange>, changeSummary: TChangeSummary | undefined) => boolean;
    }
    const enum State {
        /**
         * Dependencies might have changed. Need to check if at least one dependency has actually changed.
         */
        DependenciesMightHaveChanged = 0,
        /**
         * A dependency has changed. Need to (re-)run.
         */
        Stale = 1,
        /**
         * All is up to date.
         */
        UpToDate = 2
    }
}
//# sourceMappingURL=autorun.d.ts.map