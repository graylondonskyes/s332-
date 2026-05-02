import * as React from '../../../shared/react';
import { KeybindingRegistry } from '../../browser';
import { Command, CommandRegistry } from '../../common';
export interface WindowZoomActionBarProps {
    container: HTMLElement;
    zoomLevel: number;
    commandRegistry: CommandRegistry;
    keybindingRegistry: KeybindingRegistry;
}
export declare class WindowZoomActionBar extends React.Component<WindowZoomActionBarProps> {
    protected getTitleWithKeybinding(command: Command): string;
    protected renderActionButton(command: Command, iconName?: string, commandArgs?: unknown[]): React.ReactNode;
    protected renderZoomDisplay(): React.ReactNode;
    render(): React.ReactNode;
}
/**
 * Helper function to render the WindowZoomActionBar React component into a DOM container element.
 * This function can be called from a TypeScript file without JSX.
 */
export declare function renderWindowZoomActionBar(container: HTMLElement, zoomLevel: number, commandRegistry: CommandRegistry, keybindingRegistry: KeybindingRegistry): void;
//# sourceMappingURL=window-zoom-action-bar.d.ts.map