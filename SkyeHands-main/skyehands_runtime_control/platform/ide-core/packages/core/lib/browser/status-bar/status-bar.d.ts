import * as React from 'react';
import { CommandService } from '../../common';
import { ReactWidget } from '../widgets/react-widget';
import { FrontendApplicationStateService } from '../frontend-application-state';
import { LabelParser } from '../label-parser';
import { StatusBar, StatusBarEntry, StatusBarAlignment, StatusBarViewEntry } from './status-bar-types';
import { StatusBarViewModel } from './status-bar-view-model';
import { HoverService } from '../hover-service';
import { PreferenceService } from '../../common/preferences';
import { MarkdownString } from '../../common/markdown-rendering';
export { StatusBar, StatusBarAlignment, StatusBarEntry };
export declare class StatusBarImpl extends ReactWidget implements StatusBar {
    protected readonly commands: CommandService;
    protected readonly entryService: LabelParser;
    protected readonly applicationStateService: FrontendApplicationStateService;
    protected readonly preferences: PreferenceService;
    protected readonly viewModel: StatusBarViewModel;
    protected readonly hoverService: HoverService;
    protected backgroundColor: string | undefined;
    protected color: string | undefined;
    constructor(commands: CommandService, entryService: LabelParser, applicationStateService: FrontendApplicationStateService, preferences: PreferenceService, viewModel: StatusBarViewModel, hoverService: HoverService);
    protected debouncedUpdate: any;
    protected get ready(): Promise<void>;
    setElement(id: string, entry: StatusBarEntry): Promise<void>;
    removeElement(id: string): Promise<void>;
    setBackgroundColor(color?: string): Promise<void>;
    protected internalSetBackgroundColor(color?: string): void;
    setColor(color?: string): Promise<void>;
    protected internalSetColor(color?: string): void;
    protected render(): JSX.Element;
    protected triggerCommand(entry: StatusBarEntry): () => void;
    /**
     * Request a hover to be displayed for a status bar entry.
     * @param e The mouse event that triggered the hover request
     * @param entry The status bar entry to display hover for
     * @param skipDelay When true, requests the hover immediately without delay (for click-triggered hovers)
     */
    protected requestHover(e: React.MouseEvent<HTMLElement, MouseEvent>, entry: StatusBarEntry, skipDelay?: boolean): void;
    protected doRequestHover(target: HTMLElement, content: string | HTMLElement | MarkdownString, skipDelay?: boolean, onHide?: () => void): void;
    protected createAttributes(viewEntry: StatusBarViewEntry): React.Attributes & React.HTMLAttributes<HTMLElement>;
    protected renderElement(entry: StatusBarViewEntry): JSX.Element;
}
//# sourceMappingURL=status-bar.d.ts.map