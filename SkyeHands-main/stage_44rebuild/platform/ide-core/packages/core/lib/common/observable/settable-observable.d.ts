import { BaseObservable, Observable } from './observable-base';
export declare class SettableObservable<T, TChange = void> extends BaseObservable<T, TChange> implements Observable.Settable<T, TChange> {
    protected value: T;
    protected readonly isEqual: (a: T, b: T) => boolean;
    constructor(initialValue: T, options?: SettableObservable.Options<T>);
    protected getValue(): T;
    set(value: T, change?: TChange, updateScope?: Observable.UpdateScope | undefined): void;
    protected setValue(newValue: T): void;
}
export declare namespace SettableObservable {
    function create<T, TChange = void>(initialValue: T, options?: Options<T>): Observable.Settable<T, TChange>;
    interface Options<T> {
        isEqual?: (a: T, b: T) => boolean;
    }
}
//# sourceMappingURL=settable-observable.d.ts.map