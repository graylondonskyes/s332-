import { Disposable } from '../disposable';
import { Event } from '../event';
import { BaseObservable, Observable } from './observable-base';
export declare class ObservableFromEvent<T, E> extends BaseObservable<T> {
    protected readonly event: Event<E>;
    protected readonly compute: (e: E | undefined) => T;
    protected value?: T;
    protected subscription?: Disposable;
    protected readonly isEqual: (a: T, b: T) => boolean;
    protected readonly getUpdateScope: () => Observable.UpdateScope | undefined;
    constructor(event: Event<E>, compute: (e: E | undefined) => T, options?: ObservableFromEvent.Options<T>);
    protected handleEvent(e: E | undefined): void;
    protected onFirstObserverAdded(): void;
    protected onLastObserverRemoved(): void;
    protected hasValue(): boolean;
    protected getValue(): T;
}
export declare namespace ObservableFromEvent {
    function create<T, E>(event: Event<E>, compute: (e: E | undefined) => T, options?: Options<T>): Observable<T, void>;
    interface Options<T> {
        isEqual?: (a: T, b: T) => boolean;
        getUpdateScope?: () => Observable.UpdateScope | undefined;
    }
}
export declare class ObservableSignalFromEvent extends BaseObservable<void> {
    protected readonly event: Event<unknown>;
    protected subscription?: Disposable;
    protected readonly getUpdateScope: () => Observable.UpdateScope | undefined;
    constructor(event: Event<unknown>, options?: ObservableSignalFromEvent.Options);
    protected handleEvent(): void;
    protected onFirstObserverAdded(): void;
    protected onLastObserverRemoved(): void;
    protected getValue(): void;
}
export declare namespace ObservableSignalFromEvent {
    function create(event: Event<unknown>): Observable<void>;
    interface Options {
        getUpdateScope?: () => Observable.UpdateScope | undefined;
    }
}
//# sourceMappingURL=observable-from-event.d.ts.map