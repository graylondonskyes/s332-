import { CommandRegistry, MenuModelRegistry, PreferenceService } from '@theia/core';
import { AbstractViewContribution, KeybindingRegistry, Widget } from '@theia/core/lib/browser';
import { AIActivationService } from './ai-activation-service';
import { AICommandHandlerFactory } from './ai-command-handler-factory';
export declare class AIViewContribution<T extends Widget> extends AbstractViewContribution<T> {
    protected readonly preferenceService: PreferenceService;
    protected readonly activationService: AIActivationService;
    protected readonly commandHandlerFactory: AICommandHandlerFactory;
    protected init(): void;
    registerCommands(commands: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    registerKeybindings(keybindings: KeybindingRegistry): void;
}
//# sourceMappingURL=ai-view-contribution.d.ts.map