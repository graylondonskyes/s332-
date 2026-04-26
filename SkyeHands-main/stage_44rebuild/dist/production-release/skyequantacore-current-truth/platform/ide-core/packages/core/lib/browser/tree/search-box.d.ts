import { SearchBoxDebounce, SearchBoxDebounceOptions } from '../tree/search-box-debounce';
import { ReactWidget } from '../widgets';
import { Emitter, Event } from '../../common/event';
import { KeyCode, Key } from '../keyboard/keys';
import * as React from 'react';
/**
 * Initializer properties for the search box widget.
 */
export interface SearchBoxProps extends SearchBoxDebounceOptions {
    /**
     * If `true`, the `Previous`, `Next`, and `Close` buttons will be visible. Otherwise, `false`. Defaults to `false`.
     */
    readonly showButtons?: boolean;
    /**
     * If `true`, `Filter` and `Close` buttons will be visible, and clicking the `Filter` button will triggers filter on the search term. Defaults to `false`.
     */
    readonly showFilter?: boolean;
}
export declare namespace SearchBoxProps {
    /**
     * The default search box widget option.
     */
    const DEFAULT: SearchBoxProps;
}
/**
 * The search box widget.
 */
export declare class SearchBox extends ReactWidget {
    protected readonly props: SearchBoxProps;
    protected readonly debounce: SearchBoxDebounce;
    protected static SPECIAL_KEYS: Key[];
    protected static MAX_CONTENT_LENGTH: number;
    protected readonly nextEmitter: Emitter<void>;
    protected readonly previousEmitter: Emitter<void>;
    protected readonly closeEmitter: Emitter<void>;
    protected readonly textChangeEmitter: Emitter<string | undefined>;
    protected readonly filterToggleEmitter: Emitter<boolean>;
    protected _isFiltering: boolean;
    protected hasMatch: boolean;
    protected inputText: string;
    constructor(props: SearchBoxProps, debounce: SearchBoxDebounce);
    get onPrevious(): Event<void>;
    get onNext(): Event<void>;
    get onClose(): Event<void>;
    get onTextChange(): Event<string | undefined>;
    get onFilterToggled(): Event<boolean>;
    get isFiltering(): boolean;
    get keyCodePredicate(): KeyCode.Predicate;
    protected firePrevious(): void;
    protected fireNext(): void;
    protected fireClose(): void;
    protected fireTextChange(input: string | undefined): void;
    protected fireFilterToggle(): void;
    protected doFireFilterToggle(toggleTo?: boolean): void;
    handle(event: KeyboardEvent): void;
    protected handleArrowUp(): void;
    protected handleArrowDown(): void;
    onBeforeHide(): void;
    protected handleKey(keyCode: KeyCode): void;
    protected getTrimmedContent(data: string): string;
    protected canHandle(keyCode: KeyCode | undefined): boolean;
    protected isCtrlBackspace(keyCode: KeyCode): boolean;
    updateHighlightInfo(info: SearchBox.HighlightInfo): void;
    protected render(): React.ReactNode;
}
export declare namespace SearchBox {
    interface HighlightInfo {
        filterText: string | undefined;
        matched: number;
        total: number;
    }
}
/**
 * Search box factory.
 */
export declare const SearchBoxFactory: unique symbol;
export interface SearchBoxFactory {
    /**
     * Creates a new search box with the given initializer properties.
     */
    (props: SearchBoxProps): SearchBox;
}
//# sourceMappingURL=search-box.d.ts.map