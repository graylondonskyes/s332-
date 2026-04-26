import { CancellationToken } from '../cancellation';
import { Disposable } from '../disposable';
import { Observable } from './observable-base';
import { DerivedObservable } from './derived-observable';
import { Autorun } from './autorun';
export declare namespace ObservableUtils {
    /**
     * Creates an {@link Autorun.create autorun} that passes a collector for disposable objects to the {@link run} function.
     * The collected disposables are disposed before the next run or when the autorun is disposed.
     */
    function autorunWithDisposables<TChangeSummary = void>(run: (args: Autorun.Args<TChangeSummary> & {
        readonly toDispose: {
            push(disposable: Disposable): void;
        };
    }) => void, options?: Autorun.Options<TChangeSummary>): Disposable;
    function derivedObservableWithCache<T, TChangeSummary = void>(compute: (args: DerivedObservable.Args<TChangeSummary> & {
        readonly lastValue: T | undefined;
    }) => T, options?: DerivedObservable.Options<T, TChangeSummary>): Observable<T, void>;
    /**
     * Resolves the promise when the observable's state matches the predicate.
     */
    function waitForState<T>(observable: Observable<T | undefined>): Promise<T>;
    function waitForState<T, TState extends T>(observable: Observable<T>, predicate: (state: T) => state is TState, isError?: (state: T) => boolean | unknown | undefined, cancellationToken?: CancellationToken): Promise<TState>;
    function waitForState<T>(observable: Observable<T>, predicate: (state: T) => boolean, isError?: (state: T) => boolean | unknown | undefined, cancellationToken?: CancellationToken): Promise<T>;
}
//# sourceMappingURL=observable-utils.d.ts.map