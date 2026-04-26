import { ContextKeyService } from '../../context-key-service';
import { ReactTabBarToolbarAction, RenderedToolbarAction, TabBarToolbarActionBase } from './tab-bar-toolbar-types';
import { Widget } from '@lumino/widgets';
import { LabelParser } from '../../label-parser';
import { CommandRegistry, Event, Disposable, Emitter, DisposableCollection } from '../../../common';
import { KeybindingRegistry } from '../../keybinding';
import * as React from 'react';
import { MenuNode } from '../../../common/menu';
export interface TabBarToolbarItem {
    id: string;
    isVisible(widget: Widget): boolean;
    isEnabled(widget: Widget): boolean;
    isToggled(widget: Widget): boolean;
    render(widget?: Widget): React.ReactNode;
    onDidChange?: Event<void>;
    group?: string;
    priority?: number;
    toMenuNode?(): MenuNode | undefined;
}
declare class AbstractToolbarItemImpl<T extends TabBarToolbarActionBase> {
    protected readonly commandRegistry: CommandRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected readonly action: T;
    constructor(commandRegistry: CommandRegistry, contextKeyService: ContextKeyService, action: T);
    get id(): string;
    get group(): string | undefined;
    get priority(): number | undefined;
    get onDidChange(): Event<void> | undefined;
    isVisible(widget: Widget): boolean;
    isEnabled(widget: Widget): boolean;
    isToggled(widget: Widget): boolean;
}
export declare class RenderedToolbarItemImpl extends AbstractToolbarItemImpl<RenderedToolbarAction> implements TabBarToolbarItem {
    protected readonly keybindingRegistry: KeybindingRegistry;
    protected readonly labelParser: LabelParser;
    protected contextKeyListener: Disposable | undefined;
    protected disposables: DisposableCollection;
    constructor(commandRegistry: CommandRegistry, contextKeyService: ContextKeyService, keybindingRegistry: KeybindingRegistry, labelParser: LabelParser, action: RenderedToolbarAction);
    dispose(): void;
    updateContextKeyListener(when: string): void;
    render(widget: Widget): React.ReactNode;
    protected getToolbarItemClassNames(widget: Widget): string[];
    protected resolveKeybindingForCommand(widget: Widget, command: string | undefined): string;
    protected readonly onDidChangeEmitter: Emitter<void>;
    get onDidChange(): Event<void> | undefined;
    toMenuNode?(): MenuNode;
    protected onMouseDownEvent: (e: React.MouseEvent<HTMLElement>) => void;
    protected onMouseUpEvent: (e: React.MouseEvent<HTMLElement>) => void;
    protected executeCommand(e: React.MouseEvent<HTMLElement>, widget: Widget): void;
    protected renderItem(widget: Widget): React.ReactNode;
}
export declare class ReactToolbarItemImpl extends AbstractToolbarItemImpl<ReactTabBarToolbarAction> implements TabBarToolbarItem {
    render(widget?: Widget | undefined): React.ReactNode;
}
export {};
//# sourceMappingURL=tab-toolbar-item.d.ts.map