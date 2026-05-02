import { Event, URI, ILogger } from '@theia/core';
import { AIVariableArg, AIVariableContext, AIVariableService, ResolvedAIVariable } from './variable-service';
import { ToolInvocationRegistry } from './tool-invocation-registry';
import { ToolRequest } from './language-model';
import { AISettingsService } from './settings-service';
export interface CommandPromptFragmentMetadata {
    /** Display name for this prompt fragment (defaults to fragment id if not specified) */
    name?: string;
    /** Description of this prompt fragment's purpose */
    description?: string;
    /** Mark this template as available as a slash command */
    isCommand?: boolean;
    /** Display name for the command (defaults to fragment id if not specified) */
    commandName?: string;
    /** Description shown in command autocomplete */
    commandDescription?: string;
    /** Hint for command arguments shown in autocomplete detail (e.g., "<topic>", "[options]") */
    commandArgumentHint?: string;
    /** List of agent IDs this command is available for (undefined means available for all agents) */
    commandAgents?: string[];
}
/**
 * Represents a basic prompt fragment with an ID and template content.
 */
export interface BasePromptFragment extends CommandPromptFragmentMetadata {
    /** Unique identifier for this prompt fragment */
    id: string;
    /** The template content, which may contain variables and function references */
    template: string;
}
/**
 * Represents a customized prompt fragment with an assigned customization ID and priority.
 */
export interface CustomizedPromptFragment extends BasePromptFragment {
    /**
     * Unique identifier for this customization
     */
    customizationId: string;
    /**
     * The order/priority of this customization, higher values indicate higher priority
     * when multiple customizations exist for the same fragment
     */
    priority: number;
}
/**
 * Union type representing either a built-in or customized prompt fragment
 */
export type PromptFragment = BasePromptFragment | CustomizedPromptFragment;
/**
 * Type guard to check if a PromptFragment is a built-in fragment (not customized)
 * @param fragment The fragment to check
 * @returns True if the fragment is a basic BasePromptFragment (not customized)
 */
export declare function isBasePromptFragment(fragment: PromptFragment): fragment is BasePromptFragment;
/**
 * Type guard to check if a PromptFragment is a CustomizedPromptFragment
 * @param fragment The fragment to check
 * @returns True if the fragment is a CustomizedPromptFragment
 */
export declare function isCustomizedPromptFragment(fragment: PromptFragment): fragment is CustomizedPromptFragment;
/**
 * Contains the effective variant ID and customization state for a prompt fragment
 */
export interface PromptVariantInfo {
    /** The effective variant ID for the prompt fragment */
    variantId: string;
    /** Whether this variant has been customized by the user */
    isCustomized: boolean;
}
/**
 * Map of prompt fragment IDs to prompt fragments
 */
export interface PromptMap {
    [id: string]: PromptFragment;
}
/**
 * Represents a prompt fragment with all variables and function references resolved
 */
export interface ResolvedPromptFragment {
    /** The fragment ID */
    id: string;
    /** The resolved prompt text with variables and function requests being replaced */
    text: string;
    /** All functions referenced in the prompt fragment */
    functionDescriptions?: Map<string, ToolRequest>;
    /** All variables resolved in the prompt fragment */
    variables?: ResolvedAIVariable[];
}
/**
 * Describes a custom agent with its properties
 */
export interface CustomAgentDescription {
    /** Unique identifier for this agent */
    id: string;
    /** Display name for the agent */
    name: string;
    /** Description of the agent's purpose and capabilities */
    description: string;
    /** The prompt text for this agent */
    prompt: string;
    /** The default large language model to use with this agent */
    defaultLLM: string;
    /** Whether this agent should appear in the chat UI (defaults to true if not specified) */
    showInChat?: boolean;
}
export declare namespace CustomAgentDescription {
    /**
     * Type guard to check if an object is a CustomAgentDescription
     */
    function is(entry: unknown): entry is CustomAgentDescription;
    /**
     * Compares two CustomAgentDescription objects for equality
     */
    function equals(a: CustomAgentDescription, b: CustomAgentDescription): boolean;
}
/**
 * Service responsible for customizing prompt fragments
 */
export declare const PromptFragmentCustomizationService: unique symbol;
export interface PromptFragmentCustomizationService {
    /**
     * Event fired when a prompt fragment is changed
     */
    readonly onDidChangePromptFragmentCustomization: Event<string[]>;
    /**
     * Event fired when custom agents are modified
     */
    readonly onDidChangeCustomAgents: Event<void>;
    /**
     * Checks if a prompt fragment has customizations
     * @param fragmentId The prompt fragment ID
     * @returns Whether the fragment has any customizations
     */
    isPromptFragmentCustomized(fragmentId: string): boolean;
    /**
     * Gets the active customized prompt fragment for a given ID
     * @param fragmentId The prompt fragment ID
     * @returns The active customized fragment or undefined if none exists
     */
    getActivePromptFragmentCustomization(fragmentId: string): CustomizedPromptFragment | undefined;
    /**
     * Gets all customizations for a prompt fragment ordered by priority
     * @param fragmentId The prompt fragment ID
     * @returns Array of customized fragments ordered by priority (highest first)
     */
    getAllCustomizations(fragmentId: string): CustomizedPromptFragment[];
    /**
     * Gets the IDs of all prompt fragments that have customizations
     * @returns Array of prompt fragment IDs
     */
    getCustomizedPromptFragmentIds(): string[];
    /**
     * Creates a new customization for a prompt fragment
     * @param fragmentId The fragment ID to customize
     * @param defaultContent Optional default content for the customization
     */
    createPromptFragmentCustomization(fragmentId: string, defaultContent?: string): Promise<void>;
    /**
     * Creates a customization based on a built-in fragment
     * @param fragmentId The ID of the built-in fragment to customize
     * @param defaultContent Optional default content for the customization
     */
    createBuiltInPromptFragmentCustomization(fragmentId: string, defaultContent?: string): Promise<void>;
    /**
     * Edits a specific customization of a prompt fragment
     * @param fragmentId The prompt fragment ID
     * @param customizationId The customization ID to edit
     */
    editPromptFragmentCustomization(fragmentId: string, customizationId: string): Promise<void>;
    /**
     * Edits the built-in customization of a prompt fragment
     * @param fragmentId The prompt fragment ID to edit
     * @param defaultContent Optional default content for the customization
     */
    editBuiltInPromptFragmentCustomization(fragmentId: string, defaultContent?: string): Promise<void>;
    /**
     * Removes a specific customization of a prompt fragment
     * @param fragmentId The prompt fragment ID
     * @param customizationId The customization ID to remove
     */
    removePromptFragmentCustomization(fragmentId: string, customizationId: string): Promise<void>;
    /**
     * Resets a fragment to its built-in version by removing all customizations
     * @param fragmentId The fragment ID to reset
     */
    removeAllPromptFragmentCustomizations(fragmentId: string): Promise<void>;
    /**
     * Resets to a specific customization by removing higher-priority customizations
     * @param fragmentId The fragment ID
     * @param customizationId The customization ID to reset to
     */
    resetToCustomization(fragmentId: string, customizationId: string): Promise<void>;
    /**
     * Gets information about the description of a customization
     * @param fragmentId The fragment ID
     * @param customizationId The customization ID
     * @returns Description of the customization
     */
    getPromptFragmentCustomizationDescription(fragmentId: string, customizationId: string): Promise<string | undefined>;
    /**
     * Gets information about the source/type of a customization
     * @param fragmentId The fragment ID
     * @param customizationId The customization ID
     * @returns Type of the customization source
     */
    getPromptFragmentCustomizationType(fragmentId: string, customizationId: string): Promise<string | undefined>;
    /**
     * Gets the fragment ID from a resource identifier
     * @param resourceId Resource identifier (implementation specific)
     * @returns Fragment ID or undefined if not found
     */
    getPromptFragmentIDFromResource(resourceId: unknown): string | undefined;
    /**
     * Gets all custom agent descriptions
     * @returns Array of custom agent descriptions
     */
    getCustomAgents(): Promise<CustomAgentDescription[]>;
    /**
     * Gets the locations of custom agent configuration files
     * @returns Array of URIs and existence status
     */
    getCustomAgentsLocations(): Promise<{
        uri: URI;
        exists: boolean;
    }[]>;
    /**
     * Opens an existing customAgents.yml file at the given URI, or creates a new one if it doesn't exist.
     *
     * @param uri The URI of the customAgents.yml file to open or create
     */
    openCustomAgentYaml(uri: URI): Promise<void>;
}
/**
 * Service for managing and resolving prompt fragments
 */
export declare const PromptService: unique symbol;
export interface PromptService {
    /**
     * Event fired when the prompts change
     */
    readonly onPromptsChange: Event<void>;
    /**
     * Event fired when the selected variant for a prompt variant set changes
     */
    readonly onSelectedVariantChange: Event<{
        promptVariantSetId: string;
        variantId: string | undefined;
    }>;
    /**
     * Gets the raw prompt fragment with comments
     * @param fragmentId The prompt fragment ID
     * @returns The raw prompt fragment or undefined if not found
     */
    getRawPromptFragment(fragmentId: string): PromptFragment | undefined;
    /**
     * Gets the raw prompt fragment without comments
     * @param fragmentId The prompt fragment ID
     * @returns The raw prompt fragment or undefined if not found
     */
    getPromptFragment(fragmentId: string): PromptFragment | undefined;
    /**
     * Gets the built-in raw prompt fragment (before any customizations)
     * @param fragmentId The prompt fragment ID
     * @returns The built-in fragment or undefined if not found
     */
    getBuiltInRawPrompt(fragmentId: string): PromptFragment | undefined;
    /**
     * Gets a prompt fragment by command name (for slash commands)
     * @param commandName The command name to search for
     * @returns The fragment with the matching command name or undefined if not found
     */
    getPromptFragmentByCommandName(commandName: string): PromptFragment | undefined;
    /**
     * Resolves a prompt fragment by replacing variables and function references
     * @param fragmentId The prompt fragment ID
     * @param args Optional object with values for variable replacement
     * @param context Optional context for variable resolution
     * @returns The resolved prompt fragment or undefined if not found
     */
    getResolvedPromptFragment(fragmentId: string, args?: {
        [key: string]: unknown;
    }, context?: AIVariableContext): Promise<ResolvedPromptFragment | undefined>;
    /**
     * Resolves a prompt fragment by replacing variables but preserving function references
     * @param fragmentId The prompt fragment ID
     * @param args Optional object with values for variable replacement
     * @param context Optional context for variable resolution
     * @param resolveVariable Optional custom variable resolution function
     * @returns The partially resolved prompt fragment or undefined if not found
     */
    getResolvedPromptFragmentWithoutFunctions(fragmentId: string, args?: {
        [key: string]: unknown;
    }, context?: AIVariableContext, resolveVariable?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<Omit<ResolvedPromptFragment, 'functionDescriptions'> | undefined>;
    /**
     * Adds a prompt fragment to the service
     * @param promptFragment The fragment to store
     * @param promptVariantSetId Optional ID of the prompt variant set this is a variant of
     */
    addBuiltInPromptFragment(promptFragment: BasePromptFragment, promptVariantSetId?: string, isDefault?: boolean): void;
    /**
     * Removes a prompt fragment from the service
     * @param fragmentId The fragment ID to remove
     */
    removePromptFragment(fragmentId: string): void;
    /**
     * Gets all known prompts, including variants and customizations
     * @returns Map of fragment IDs to arrays of fragments
     */
    getAllPromptFragments(): Map<string, PromptFragment[]>;
    /**
     * Gets all active prompts (highest priority version of each fragment)
     * @returns Array of active prompt fragments
     */
    getActivePromptFragments(): PromptFragment[];
    /**
     * Returns all IDs of all prompt fragments of the given set
     * @param promptVariantSetId The prompt variant set id
     * @returns Array of variant IDs
     */
    getVariantIds(promptVariantSetId: string): string[];
    /**
     * Gets the explicitly selected variant ID for a prompt fragment from settings.
     * This returns only the variant that was explicitly selected in settings, not the default.
     * @param promptVariantSetId The prompt variant set id
     * @returns The selected variant ID from settings, or undefined if none is selected
     */
    getSelectedVariantId(promptVariantSetId: string): string | undefined;
    /**
     * Gets the effective variant ID that is guaranteed to be valid if one exists.
     * This checks if the selected variant ID is valid, and falls back to the default variant if it isn't.
     * @param promptVariantSetId The prompt variant set id
     * @returns A valid variant ID if one exists, or undefined if no valid variant can be found
     */
    getEffectiveVariantId(promptVariantSetId: string): string | undefined;
    /**
     * Gets the effective variant ID and customization state for a prompt fragment.
     * This is a convenience method that combines getEffectiveVariantId and customization check.
     * @param fragmentId The prompt fragment ID or variant set ID
     * @param modeId Optional mode ID to use as variant override (if it's a valid variant for the fragment)
     * @returns The variant info or undefined if no valid variant exists
     */
    getPromptVariantInfo(fragmentId: string, modeId?: string): PromptVariantInfo | undefined;
    /**
     * Gets the default variant ID of the given set
     * @param promptVariantSetId The prompt variant set id
     * @returns The default variant ID or undefined if no default is set
     */
    getDefaultVariantId(promptVariantSetId: string): string | undefined;
    /**
     * Updates the selected variant for a prompt variant set
     * @param agentId The ID of the agent to update
     * @param promptVariantSetId The prompt variant set ID
     * @param newVariant The new variant ID to set as selected
     */
    updateSelectedVariantId(agentId: string, promptVariantSetId: string, newVariant: string): Promise<void>;
    /**
     * Gets all prompt variant sets and their variants
     * @returns Map of prompt variant set IDs to arrays of variant IDs
     */
    getPromptVariantSets(): Map<string, string[]>;
    /**
     * Gets all prompt fragments marked as commands, optionally filtered by agent
     * @param agentId Optional agent ID to filter commands (undefined returns commands for all agents)
     * @returns Array of command prompt fragments
     */
    getCommands(agentId?: string): PromptFragment[];
    /**
     * The following methods delegate to the PromptFragmentCustomizationService
     */
    createCustomization(fragmentId: string): Promise<void>;
    createBuiltInCustomization(fragmentId: string): Promise<void>;
    editBuiltInCustomization(fragmentId: string): Promise<void>;
    editCustomization(fragmentId: string, customizationId: string): Promise<void>;
    removeCustomization(fragmentId: string, customizationId: string): Promise<void>;
    resetAllToBuiltIn(): Promise<void>;
    resetToBuiltIn(fragmentId: string): Promise<void>;
    resetToCustomization(fragmentId: string, customizationId: string): Promise<void>;
    getCustomizationDescription(fragmentId: string, customizationId: string): Promise<string | undefined>;
    getCustomizationType(fragmentId: string, customizationId: string): Promise<string | undefined>;
    getTemplateIDFromResource(resourceId: unknown): string | undefined;
}
export declare class PromptServiceImpl implements PromptService {
    protected readonly logger: ILogger;
    protected readonly settingsService: AISettingsService | undefined;
    protected readonly customizationService: PromptFragmentCustomizationService | undefined;
    protected _selectedVariantsMap: Map<string, string>;
    protected readonly variableService: AIVariableService | undefined;
    protected readonly toolInvocationRegistry: ToolInvocationRegistry | undefined;
    protected _builtInFragments: BasePromptFragment[];
    protected _promptVariantSetsMap: Map<string, string[]>;
    protected _defaultVariantsMap: Map<string, string>;
    protected _onPromptsChangeEmitter: any;
    readonly onPromptsChange: any;
    protected _onSelectedVariantChangeEmitter: any;
    readonly onSelectedVariantChange: any;
    protected promptChangeDebounceTimer?: NodeJS.Timeout;
    protected toDispose: any;
    protected fireOnPromptsChangeDebounced(): void;
    protected init(): void;
    /**
     * Recalculates the selected variants map for all variant sets and fires the onSelectedVariantChangeEmitter
     * if the selectedVariants field has changed.
     */
    protected recalculateSelectedVariantsMap(): Promise<void>;
    /**
     * Finds a built-in fragment by its ID
     * @param fragmentId The ID of the fragment to find
     * @returns The built-in fragment or undefined if not found
     */
    protected findBuiltInFragmentById(fragmentId: string): BasePromptFragment | undefined;
    protected findBuiltInFragmentByName(fragmentName: string): BasePromptFragment | undefined;
    getRawPromptFragment(fragmentId: string): PromptFragment | undefined;
    getBuiltInRawPrompt(fragmentId: string): PromptFragment | undefined;
    getPromptFragment(fragmentId: string): PromptFragment | undefined;
    getPromptFragmentByCommandName(commandName: string): PromptFragment | undefined;
    /**
     * Strips comments from a template string
     * @param templateText The template text to process
     * @returns Template text with comments removed
     */
    protected stripComments(templateText: string): string;
    /**
     * Extracts metadata fields from YAML front matter in the template and
     * merges them onto the fragment. Programmatic fields take precedence over
     * front matter values so callers can still override individual fields.
     */
    protected enrichWithFrontMatter(fragment: BasePromptFragment): BasePromptFragment;
    getSelectedVariantId(variantSetId: string): string | undefined;
    getEffectiveVariantId(variantSetId: string): string | undefined;
    getPromptVariantInfo(fragmentId: string, modeId?: string): PromptVariantInfo | undefined;
    protected resolvePotentialSystemPrompt(promptFragmentId: string): PromptFragment | undefined;
    getResolvedPromptFragment(systemOrFragmentId: string, args?: {
        [key: string]: unknown;
    }, context?: AIVariableContext): Promise<ResolvedPromptFragment | undefined>;
    getResolvedPromptFragmentWithoutFunctions(systemOrFragmentId: string, args?: {
        [key: string]: unknown;
    }, context?: AIVariableContext, resolveVariable?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<Omit<ResolvedPromptFragment, 'functionDescriptions'> | undefined>;
    /**
     * Calculates all variable and argument replacements for an unresolved template.
     *
     * @param templateText the unresolved template text
     * @param args the object with placeholders, mapping the placeholder key to the value
     * @param context the {@link AIVariableContext} to use during variable resolution
     * @param resolveVariable the variable resolving method. Fall back to using the {@link AIVariableService} if not given.
     * @returns Object containing replacements and resolved variables
     */
    protected resolveVariablesAndArgs(templateText: string, args?: {
        [key: string]: unknown;
    }, context?: AIVariableContext, resolveVariable?: (variable: AIVariableArg) => Promise<ResolvedAIVariable | undefined>): Promise<{
        replacements: {
            placeholder: string;
            value: string;
        }[];
        resolvedVariables: ResolvedAIVariable[];
    }>;
    getAllPromptFragments(): Map<string, PromptFragment[]>;
    getActivePromptFragments(): PromptFragment[];
    removePromptFragment(fragmentId: string): void;
    getVariantIds(variantSetId: string): string[];
    getDefaultVariantId(promptVariantSetId: string): string | undefined;
    getPromptVariantSets(): Map<string, string[]>;
    addBuiltInPromptFragment(promptFragment: BasePromptFragment, promptVariantSetId?: string, isDefault?: boolean): void;
    protected checkCommandUniqueness(promptFragment: BasePromptFragment): void;
    /**
     * Adds a variant ID to the fragment variants map
     * @param promptVariantSetId The prompt variant set id
     * @param variantId The variant ID to add
     * @param isDefault Whether this variant should be the default for the prompt variant set (defaults to false)
     */
    protected addFragmentVariant(promptVariantSetId: string, variantId: string, isDefault?: boolean): void;
    /**
     * Removes a variant ID from the fragment variants map
     * @param promptVariantSetId The prompt variant set id
     * @param variantId The variant ID to remove
     */
    protected removeFragmentVariant(promptVariantSetId: string, variantId: string): void;
    updateSelectedVariantId(agentId: string, promptVariantSetId: string, newVariant: string): Promise<void>;
    createCustomization(fragmentId: string): Promise<void>;
    createBuiltInCustomization(fragmentId: string): Promise<void>;
    editCustomization(fragmentId: string, customizationId: string): Promise<void>;
    removeCustomization(fragmentId: string, customizationId: string): Promise<void>;
    resetAllToBuiltIn(): Promise<void>;
    resetToBuiltIn(fragmentId: string): Promise<void>;
    resetToCustomization(fragmentId: string, customizationId: string): Promise<void>;
    getCustomizationDescription(fragmentId: string, customizationId: string): Promise<string | undefined>;
    getCustomizationType(fragmentId: string, customizationId: string): Promise<string | undefined>;
    getTemplateIDFromResource(resourceId: unknown): string | undefined;
    editBuiltInCustomization(fragmentId: string): Promise<void>;
    getCommands(agentId?: string): PromptFragment[];
}
//# sourceMappingURL=prompt-service.d.ts.map