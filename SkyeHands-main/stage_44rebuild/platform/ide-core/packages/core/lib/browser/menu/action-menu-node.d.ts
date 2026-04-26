import { KeybindingRegistry } from '../keybinding';
import { ContextKeyService } from '../context-key-service';
import { DisposableCollection, CommandRegistry, Emitter } from '../../common';
import { CommandMenu, ContextExpressionMatcher, MenuAction, MenuPath } from '../../common/menu/menu-types';
export interface AcceleratorSource {
    getAccelerator(context: HTMLElement | undefined): string[];
}
export declare namespace AcceleratorSource {
    function is(node: unknown): node is AcceleratorSource;
}
/**
 * Node representing an action in the menu tree structure.
 * It's based on {@link MenuAction} for which it tries to determine the
 * best label, icon and sortString with the given data.
 */
export declare class ActionMenuNode implements CommandMenu {
    protected readonly action: MenuAction;
    protected readonly commands: CommandRegistry;
    protected readonly keybindingRegistry: KeybindingRegistry;
    protected readonly contextKeyService: ContextKeyService;
    protected readonly disposables: DisposableCollection;
    protected readonly onDidChangeEmitter: Emitter<void>;
    onDidChange: import("../../common").Event<void>;
    constructor(action: MenuAction, commands: CommandRegistry, keybindingRegistry: KeybindingRegistry, contextKeyService: ContextKeyService);
    dispose(): void;
    isVisible<T>(effeciveMenuPath: MenuPath, contextMatcher: ContextExpressionMatcher<T>, context: T | undefined, ...args: unknown[]): boolean;
    getAccelerator(context: HTMLElement | undefined): string[];
    isEnabled(effeciveMenuPath: MenuPath, ...args: unknown[]): boolean;
    isToggled(effeciveMenuPath: MenuPath, ...args: unknown[]): boolean;
    run(effeciveMenuPath: MenuPath, ...args: unknown[]): Promise<void>;
    get id(): string;
    get label(): string;
    get icon(): string | undefined;
    get sortString(): string;
}
//# sourceMappingURL=action-menu-node.d.ts.map