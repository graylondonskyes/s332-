import '../../src/browser/style/output.css';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { MonacoEditorProvider } from '@theia/monaco/lib/browser/monaco-editor-provider';
import { Message, BaseWidget, DockPanel, Widget, StatefulWidget, StorageService } from '@theia/core/lib/browser';
import { OutputChannelManager } from './output-channel';
import { Event } from '@theia/core';
export declare class OutputWidget extends BaseWidget implements StatefulWidget {
    static readonly ID = "outputView";
    static readonly LABEL: any;
    static readonly SELECTED_CHANNEL_STORAGE_KEY = "output-widget-selected-channel";
    protected readonly selectionService: SelectionService;
    protected readonly editorProvider: MonacoEditorProvider;
    protected readonly outputChannelManager: OutputChannelManager;
    protected readonly storageService: StorageService;
    protected _state: OutputWidget.State;
    protected readonly editorContainer: DockPanel;
    protected readonly toDisposeOnSelectedChannelChanged: any;
    protected readonly onStateChangedEmitter: any;
    constructor();
    protected init(): void;
    /**
     * Restore the selected channel from storage (used when widget is reopened).
     * State restoration has higher priority, so this only applies if state restoration hasn't already
     * set a selectedChannelName or pendingSelectedChannelName.
     */
    protected restoreSelectedChannelFromStorage(): Promise<void>;
    dispose(): void;
    /**
     * Try to restore the pending channel if it matches the newly added channel.
     */
    protected tryRestorePendingChannel(addedChannelName: string): void;
    /**
     * Clear any pending channel restoration.
     * Called when the user explicitly selects a channel, so we don't override their choice.
     */
    protected clearPendingChannelRestore(): void;
    storeState(): object;
    restoreState(oldState: object & Partial<OutputWidget.State>): void;
    protected get state(): OutputWidget.State;
    protected set state(state: OutputWidget.State);
    protected refreshEditorWidget({ preserveFocus }?: {
        preserveFocus: boolean;
    }): Promise<void>;
    protected onAfterAttach(message: Message): void;
    protected onActivateRequest(message: Message): void;
    protected onResize(message: Widget.ResizeMessage): void;
    protected onAfterShow(msg: Message): void;
    get onStateChanged(): Event<OutputWidget.State>;
    clear(): void;
    selectAll(): void;
    lock(): void;
    unlock(): void;
    get isLocked(): boolean;
    protected revealLastLine(): void;
    private get selectedChannel();
    private createEditorWidget;
    private get editorWidget();
    private get editor();
    getText(): string | undefined;
}
export declare namespace OutputWidget {
    interface State {
        locked?: boolean;
        selectedChannelName?: string;
        /** Channel name waiting to be restored when it becomes available */
        pendingSelectedChannelName?: string;
    }
}
//# sourceMappingURL=output-widget.d.ts.map