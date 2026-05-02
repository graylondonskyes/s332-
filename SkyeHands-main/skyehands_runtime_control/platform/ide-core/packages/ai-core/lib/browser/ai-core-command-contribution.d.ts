import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { AICommandHandlerFactory } from './ai-command-handler-factory';
export declare const AI_SHOW_SETTINGS_COMMAND: Command;
export declare class AiCoreCommandContribution implements CommandContribution {
    protected readonly handlerFactory: AICommandHandlerFactory;
    registerCommands(commands: CommandRegistry): void;
}
//# sourceMappingURL=ai-core-command-contribution.d.ts.map