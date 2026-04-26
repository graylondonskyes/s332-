import URI from '@theia/core/lib/common/uri';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { Resource, ResourceResolver } from '@theia/core/lib/common/resource';
import { Event, Disposable } from '@theia/core';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import { OutputResource } from '../browser/output-resource';
import { OutputPreferences } from '../common/output-preferences';
import { IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import * as monaco from '@theia/monaco-editor-core';
import PQueue from 'p-queue';
export declare class OutputChannelManager implements Disposable, ResourceResolver {
    protected readonly textModelService: MonacoTextModelService;
    protected readonly preferences: OutputPreferences;
    protected readonly channels: Map<string, OutputChannel>;
    protected readonly resources: Map<string, OutputResource>;
    protected _selectedChannel: OutputChannel | undefined;
    protected readonly channelAddedEmitter: any;
    protected readonly channelDeletedEmitter: any;
    protected readonly channelWasShownEmitter: any;
    protected readonly channelWasHiddenEmitter: any;
    protected readonly selectedChannelChangedEmitter: any;
    readonly onChannelAdded: any;
    readonly onChannelDeleted: any;
    readonly onChannelWasShown: any;
    readonly onChannelWasHidden: any;
    readonly onSelectedChannelChanged: any;
    protected readonly toDispose: any;
    protected readonly toDisposeOnChannelDeletion: Map<string, Disposable>;
    getChannel(name: string): OutputChannel;
    protected registerListeners(channel: OutputChannel): Disposable;
    deleteChannel(name: string): void;
    getChannels(): OutputChannel[];
    getVisibleChannels(): OutputChannel[];
    protected get channelComparator(): (left: OutputChannel, right: OutputChannel) => number;
    dispose(): void;
    get selectedChannel(): OutputChannel | undefined;
    set selectedChannel(channel: OutputChannel | undefined);
    /**
     * Non-API: do not call directly.
     */
    resolve(uri: URI): Promise<Resource>;
    protected createResource({ uri, editorModelRef }: {
        uri: URI;
        editorModelRef: Deferred<IReference<MonacoEditorModel>>;
    }): OutputResource;
    protected createChannel(resource: OutputResource): OutputChannel;
}
export declare enum OutputChannelSeverity {
    Error = 1,
    Warning = 2,
    Info = 3
}
export declare class OutputChannel implements Disposable {
    protected readonly resource: OutputResource;
    protected readonly preferences: OutputPreferences;
    protected readonly contentChangeEmitter: any;
    protected readonly visibilityChangeEmitter: any;
    protected readonly disposedEmitter: any;
    protected readonly textModifyQueue: PQueue<import("p-queue/dist/priority-queue").default, import("p-queue").QueueAddOptions>;
    protected readonly toDispose: any;
    protected disposed: boolean;
    protected visible: boolean;
    protected _maxLineNumber: number;
    protected decorationIds: Set<string>;
    readonly onVisibilityChange: Event<{
        isVisible: boolean;
        preserveFocus?: boolean;
    }>;
    readonly onContentChange: Event<void>;
    readonly onDisposed: Event<void>;
    constructor(resource: OutputResource, preferences: OutputPreferences);
    get name(): string;
    get uri(): URI;
    hide(): void;
    /**
     * If `preserveFocus` is `true`, the channel will not take focus. It is `false` by default.
     *  - Calling `show` without args or with `preserveFocus: false` will reveal **and** activate the `Output` widget.
     *  - Calling `show` with `preserveFocus: true` will reveal the `Output` widget but **won't** activate it.
     */
    show({ preserveFocus }?: {
        preserveFocus: boolean;
    }): void;
    /**
     * Note: if `false` it does not meant it is disposed or not available, it is only hidden from the UI.
     */
    get isVisible(): boolean;
    clear(): void;
    dispose(): void;
    append(content: string, severity?: OutputChannelSeverity): void;
    appendLine(content: string, severity?: OutputChannelSeverity): void;
    protected doAppend({ content, severity, appendEol }: {
        content: string;
        severity: OutputChannelSeverity;
        appendEol?: boolean;
    }): Promise<void>;
    protected ensureMaxChannelHistory(textModel: monaco.editor.ITextModel): void;
    protected get maxLineNumber(): number;
    protected set maxLineNumber(maxLineNumber: number);
}
//# sourceMappingURL=output-channel.d.ts.map