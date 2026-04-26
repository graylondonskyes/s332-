import { BaseObservable, Observable } from './observable-base';
export declare class ObservableSignal<TChange> extends BaseObservable<void, TChange> implements Observable.Signal<TChange> {
    trigger(change?: TChange, updateScope?: Observable.UpdateScope | undefined): void;
    protected getValue(): void;
}
export declare namespace ObservableSignal {
    function create<TChange = void>(): Observable.Signal<TChange>;
}
//# sourceMappingURL=observable-signal.d.ts.map