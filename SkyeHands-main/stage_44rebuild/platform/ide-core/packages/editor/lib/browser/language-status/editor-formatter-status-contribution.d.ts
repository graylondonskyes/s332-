import { QuickInputService, QuickPickItem, StatusBarEntry } from '@theia/core/lib/browser';
import { PreferenceScope } from '@theia/core';
import { Severity } from '@theia/core/lib/common/severity';
import { TextEditor } from '../editor';
import { FormatterService, FormatterStatus, FormatterInfo } from '../editor-formatter-service';
import { LanguageStatus } from './editor-language-status-service';
/**
 * Icons used for formatter status display.
 * - info: normal state (configured, auto-selected, or no formatters)
 * - error: invalid configuration with no fallback
 * - warning: invalid config with fallback available (single formatter case)
 */
declare const enum FormatterIcon {
    Info = "$(info)",
    Error = "$(error)",
    Warning = "$(warning)"
}
/**
 * Display information for a formatter status.
 */
interface FormatterDisplayInfo {
    /** Icon to display (check, error, warning) */
    icon: FormatterIcon;
    /** Label text (formatter name or status) */
    label: string;
    /** Tooltip text for hover */
    tooltip: string;
    /** Whether the configure action should be available */
    hasConfigureAction: boolean;
    /** Severity for the language status item */
    severity: Severity;
}
/**
 * Handles formatter-related status bar functionality.
 * Responsible for creating formatter status items, displaying formatter quick picks,
 * and managing pinned formatter items in the status bar.
 */
export declare class EditorFormatterStatusContribution {
    static readonly FORMATTER_STATUS_ITEM_ID = "editor-formatter-status";
    protected readonly formatterService: FormatterService | undefined;
    protected readonly quickInputService: QuickInputService | undefined;
    /**
     * Creates a language status item for the formatter.
     * Returns undefined if no formatter service is available.
     */
    createFormatterStatusItem(editor: TextEditor): LanguageStatus | undefined;
    /**
     * Gets the tooltip text for the formatter status item.
     */
    getTooltip(editor: TextEditor): string;
    /**
     * Creates a status bar entry for a pinned formatter item.
     * Includes proper tooltip and icon.
     */
    createPinnedStatusBarEntry(editor: TextEditor | undefined, onclick?: (e: MouseEvent) => void): StatusBarEntry;
    /**
     * Shows the formatter selection quick pick dialog.
     */
    showFormatterQuickPick(editor: TextEditor): Promise<void>;
    /**
     * Returns true if the formatter service is available.
     */
    isAvailable(): boolean;
    /**
     * Returns true if the configure action should be available for the given editor.
     * Configure is available when there are multiple formatters or an invalid configuration.
     */
    hasConfigureAction(editor: TextEditor): boolean;
    /**
     * Gets the formatter display info for the given editor.
     * Caches the status to avoid repeated service calls.
     */
    protected getFormatterDisplayInfo(editor: TextEditor, useShortLabel?: boolean): FormatterDisplayInfo;
    /**
     * Builds display info based on the current formatter state.
     * @param status The formatter status
     * @param availableFormatters List of available formatters
     * @param useShortLabel If true, uses shorter labels suitable for status bar
     */
    protected buildDisplayInfo(status: FormatterStatus, availableFormatters: FormatterInfo[], useShortLabel?: boolean): FormatterDisplayInfo;
    protected buildNoFormattersDisplayInfo(status: FormatterStatus, useShortLabel?: boolean): FormatterDisplayInfo;
    protected buildSingleFormatterDisplayInfo(status: FormatterStatus, formatter: FormatterInfo): FormatterDisplayInfo;
    protected buildMultipleFormattersDisplayInfo(status: FormatterStatus, formatterCount: number): FormatterDisplayInfo;
    protected showFormatterSelectionPick(editor: TextEditor, formatters: FormatterInfo[]): Promise<QuickPickItem | undefined>;
    protected determineTargetScope(editor: TextEditor): Promise<PreferenceScope | undefined>;
    protected showScopeSelectionPick(): Promise<PreferenceScope | undefined>;
}
export {};
//# sourceMappingURL=editor-formatter-status-contribution.d.ts.map