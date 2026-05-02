import { HoverService, StatusBar, StatusBarEntry } from '@theia/core/lib/browser';
import { LanguageService } from '@theia/core/lib/browser/language-service';
import { CommandRegistry, MessageService } from '@theia/core';
import { TextEditor } from '../editor';
import { LanguageSelector } from '../../common/language-selector';
import { AccessibilityInformation } from '@theia/core/lib/common/accessibility';
import { CurrentEditorAccess } from '../editor-manager';
import { Severity } from '@theia/core/lib/common/severity';
import { LabelParser } from '@theia/core/lib/browser/label-parser';
import { FormatterService } from '../editor-formatter-service';
import { EditorFormatterStatusContribution } from './editor-formatter-status-contribution';
/**
 * Represents the severity of a language status item.
 */
export declare enum LanguageStatusSeverity {
    Information = 0,
    Warning = 1,
    Error = 2
}
/**
 * Command represents a particular invocation of a registered command.
 */
export interface Command {
    /**
     * The identifier of the actual command handler.
     */
    id: string;
    /**
     * Title of the command invocation, like "Add local variable 'foo'".
     */
    title?: string;
    /**
     * A tooltip for for command, when represented in the UI.
     */
    tooltip?: string;
    /**
     * Arguments that the command handler should be
     * invoked with.
     */
    arguments?: unknown[];
}
/**
 * A language status item is the preferred way to present language status reports for the active text editors,
 * such as selected linter or notifying about a configuration problem.
 */
export interface LanguageStatus {
    readonly id: string;
    readonly name: string;
    readonly selector: LanguageSelector;
    readonly severity: Severity;
    readonly label: string;
    readonly detail: string;
    readonly busy: boolean;
    readonly source: string;
    readonly command: Command | undefined;
    readonly accessibilityInfo: AccessibilityInformation | undefined;
}
export declare class EditorLanguageStatusService {
    protected readonly statusBar: StatusBar;
    protected readonly languages: LanguageService;
    protected readonly editorAccess: CurrentEditorAccess;
    protected readonly commandRegistry: CommandRegistry;
    protected readonly labelParser: LabelParser;
    protected readonly formatterService: FormatterService | undefined;
    protected readonly formatterStatusContribution: EditorFormatterStatusContribution | undefined;
    protected readonly messageService: MessageService;
    protected readonly hoverService: HoverService;
    protected static LANGUAGE_MODE_ID: string;
    protected static LANGUAGE_STATUS_ID: string;
    protected readonly status: Map<number, LanguageStatus>;
    protected pinnedCommands: Set<string>;
    protected currentlyPinnedItems: Set<string>;
    protected readonly toDisposeOnEditorChange: any;
    protected pendingUpdate: Promise<void> | undefined;
    setLanguageStatusItem(handle: number, item: LanguageStatus): void;
    removeLanguageStatusItem(handle: number): void;
    updateLanguageStatus(editor: TextEditor | undefined): void;
    /**
     * Schedules an update to the status bar. All updates are chained to prevent race conditions.
     * @param editor The current editor, or undefined if no editor is active
     * @param updateLanguageMode Whether to update the language mode element (only needed on editor change)
     */
    protected scheduleUpdate(editor: TextEditor | undefined, updateLanguageMode: boolean): void;
    protected updateLanguageModeElement(editor: TextEditor | undefined): Promise<void>;
    protected createFormatterStatusItem(editor: TextEditor): LanguageStatus | undefined;
    /**
     * Schedules a language status items update. Called when language status items are added/removed.
     */
    protected updateLanguageStatusItems(editor?: TextEditor | undefined): void;
    /**
     * Performs the actual language status items update.
     */
    protected doUpdateLanguageStatusItems(editor: TextEditor | undefined): Promise<void>;
    /**
     * Updates pinned status bar items. Removes all currently pinned items first,
     * then adds back only those relevant to the current editor context.
     */
    protected updatePinnedItems(items?: LanguageStatus[], editor?: TextEditor): Promise<void>;
    protected toPinnedItem(item: LanguageStatus, editor?: TextEditor): StatusBarEntry;
    protected isFormatterItem(item: LanguageStatus): boolean;
    protected createFormatterPinnedItem(item: LanguageStatus, editor?: TextEditor): StatusBarEntry;
    protected createDefaultPinnedItem(item: LanguageStatus): StatusBarEntry;
    protected createTooltip(items: LanguageStatus[], editor?: TextEditor): HTMLElement;
    protected createTooltipItem(item: LanguageStatus, editor?: TextEditor): HTMLElement;
    protected createSeverityIndicator(severity: Severity, alwaysShow?: boolean): HTMLElement;
    protected createLabelSection(item: LanguageStatus): HTMLElement;
    protected createCommandSection(item: LanguageStatus, editor?: TextEditor): HTMLElement;
    protected addFormatterCommands(commandContainer: HTMLElement, item: LanguageStatus, editor: TextEditor): void;
    protected createFormatterConfigureButton(editor: TextEditor): HTMLElement;
    protected createFormatterInfoButton(editor: TextEditor): HTMLElement;
    protected createCommandLink(item: LanguageStatus): HTMLElement;
    protected createPinButton(item: LanguageStatus, editor?: TextEditor): HTMLElement;
    protected setPinProperties(pin: HTMLElement, id: string): void;
    /**
     * Toggles whether a language status item is pinned to the status bar.
     */
    protected togglePinned(item: LanguageStatus, editor?: TextEditor): void;
    protected getSeverityIconClasses(severity: Severity): string;
    protected renderWithIcons(host: HTMLElement, text?: string): void;
}
//# sourceMappingURL=editor-language-status-service.d.ts.map