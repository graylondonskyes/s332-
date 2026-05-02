/********************************************************************************
 * Copyright (C) 2022 Arm and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 ********************************************************************************/
import type { ApplicationShell } from './shell';
import { ContributionProvider, URI, Disposable, Emitter, Event } from '../common';
import { Navigatable } from './navigatable-types';
import { AutoSaveMode, Saveable, SaveableSource, SaveableWidget, SaveOptions, PostCreationSaveableWidget } from './saveable';
import { Widget } from './widgets';
import { FrontendApplicationContribution } from './frontend-application-contribution';
import { FrontendApplication } from './frontend-application';
export declare const SaveErrorChecker: unique symbol;
/**
 * Contribution point for checking whether a given URI has errors.
 * When `files.autoSaveWhenNoErrors` is enabled, auto-save will be suppressed
 * for files where any registered checker reports errors.
 */
export interface SaveErrorChecker {
    /**
     * Returns `true` if the given URI has errors that should prevent auto-save.
     */
    hasErrors(uri: URI): boolean;
    /**
     * Event fired when the error state may have changed (e.g. diagnostics updated).
     * The SaveableService listens to this to re-evaluate auto-save for dirty widgets.
     */
    onDidErrorStateChange: Event<void>;
}
export declare class SaveableService implements FrontendApplicationContribution {
    protected readonly errorCheckers: ContributionProvider<SaveErrorChecker>;
    protected saveThrottles: Map<Widget, AutoSaveThrottle>;
    protected saveMode: AutoSaveMode;
    protected saveDelay: number;
    protected saveWhenNoErrors: boolean;
    protected shell: ApplicationShell;
    protected readonly onDidAutoSaveChangeEmitter: Emitter<AutoSaveMode>;
    protected readonly onDidAutoSaveDelayChangeEmitter: Emitter<number>;
    protected readonly onDidAutoSaveConditionsChangeEmitter: Emitter<void>;
    get onDidAutoSaveChange(): Event<AutoSaveMode>;
    get onDidAutoSaveDelayChange(): Event<number>;
    get onDidAutoSaveConditionsChange(): Event<void>;
    get autoSave(): AutoSaveMode;
    set autoSave(value: AutoSaveMode);
    get autoSaveDelay(): number;
    set autoSaveDelay(value: number);
    get autoSaveWhenNoErrors(): boolean;
    set autoSaveWhenNoErrors(value: boolean);
    onDidInitializeLayout(app: FrontendApplication): void;
    protected updateAutoSaveMode(mode: AutoSaveMode): void;
    protected updateAutoSaveDelay(delay: number): void;
    registerSaveable(widget: Widget, saveable: Saveable): Disposable;
    protected addBlurListener(widget: Widget, saveable: Saveable): Disposable;
    protected windowHasFocus(document: Document): boolean;
    protected shouldAutoSave(widget: Widget, saveable: Saveable): boolean;
    protected applySaveableWidget(widget: Widget, saveable: Saveable): void;
    protected createCloseWithSaving(): (this: SaveableWidget, options?: SaveableWidget.CloseOptions) => Promise<void>;
    protected closeWithSaving(widget: PostCreationSaveableWidget, options?: SaveableWidget.CloseOptions): Promise<void>;
    protected shouldSaveWidget(widget: PostCreationSaveableWidget, options?: SaveableWidget.CloseOptions): Promise<boolean | undefined>;
    protected closeWithoutSaving(widget: PostCreationSaveableWidget, doRevert?: boolean): Promise<void>;
    /**
     * Indicate if the document can be saved ('Save' command should be disable if not).
     */
    canSave(widget?: Widget): widget is Widget & (Saveable | SaveableSource);
    canSaveNotSaveAs(widget?: Widget): widget is Widget & (Saveable | SaveableSource);
    /**
     * Saves the document
     *
     * No op if the widget is not saveable.
     */
    save(widget: Widget | undefined, options?: SaveOptions): Promise<URI | undefined>;
    canSaveAs(saveable?: Widget): saveable is Widget & SaveableSource & Navigatable;
    saveAs(sourceWidget: Widget & SaveableSource & Navigatable, options?: SaveOptions): Promise<URI | undefined>;
}
export declare class AutoSaveThrottle implements Disposable {
    private _saveable;
    private _callback;
    private _saveService;
    private _disposable;
    private _throttle?;
    constructor(saveable: Saveable, saveService: SaveableService, callback: () => void, ...disposables: Disposable[]);
    protected throttledSave(reset?: boolean): void;
    dispose(): void;
}
//# sourceMappingURL=saveable-service.d.ts.map