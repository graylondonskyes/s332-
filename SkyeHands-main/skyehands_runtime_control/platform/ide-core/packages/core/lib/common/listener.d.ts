import { Disposable } from './disposable';
export declare namespace Listener {
    type Registration<T, U = void> = (listener: (e: T) => U) => Disposable;
    const None: Registration<void, void>;
    /**
     * Convenience function to await all listener invocations
     * @param value The value to invoke the listeners with
     * @param list the listener list to invoke
     * @returns the return values from the listener invocation
     */
    function awaitAll<T, U>(value: T, list: ListenerList<T, Promise<U>>): Promise<U[]>;
}
export declare class ListenerList<T, U> {
    private listeners;
    private registeredCount;
    registration: Listener.Registration<T, U>;
    private register;
    private remove;
    invoke(e: T, callback: (value: U) => void): void;
}
//# sourceMappingURL=listener.d.ts.map