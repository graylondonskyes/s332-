import { Event, MaybePromise } from '@theia/core';
import { AIVariableContext } from './variable-service';
/** Prompt fragment IDs for each generic capability type */
export declare const GENERIC_CAPABILITIES_SKILLS_PROMPT_ID = "generic-capabilities-skills";
export declare const GENERIC_CAPABILITIES_MCP_FUNCTIONS_PROMPT_ID = "generic-capabilities-mcp-functions";
export declare const GENERIC_CAPABILITIES_FUNCTIONS_PROMPT_ID = "generic-capabilities-functions";
export declare const GENERIC_CAPABILITIES_PROMPT_FRAGMENTS_PROMPT_ID = "generic-capabilities-prompt-fragments";
export declare const GENERIC_CAPABILITIES_AGENT_DELEGATION_PROMPT_ID = "generic-capabilities-agent-delegation";
export declare const GENERIC_CAPABILITIES_VARIABLES_PROMPT_ID = "generic-capabilities-variables";
export type CapabilityType = keyof GenericCapabilitySelections;
/** Prefix used by internal prompt fragments for generic capabilities */
export declare const GENERIC_CAPABILITIES_PROMPT_PREFIX = "generic-capabilities-";
/** Prefix used by internal variables for generic capability selections */
export declare const GENERIC_CAPABILITIES_VARIABLE_PREFIX = "selected_";
/**
 * Represents a single capability item that can be selected.
 */
export interface GenericCapabilityItem {
    /** Unique identifier for this capability */
    id: string;
    /** Display name for the capability */
    name: string;
    /** Optional group name for grouping related items */
    group?: string;
    /** Optional description */
    description?: string;
}
/**
 * Represents a group of capability items.
 */
export interface GenericCapabilityGroup {
    /** Group name */
    name: string;
    /** Items in this group */
    items: GenericCapabilityItem[];
}
export declare const GenericCapabilitiesContribution: unique symbol;
/**
 * Contribution point for external packages to provide additional generic capabilities.
 * For example, the MCP package can contribute MCP tool functions without
 * creating coupling between unrelated packages.
 */
export interface GenericCapabilitiesContribution {
    /** The capability type this contribution provides items for */
    readonly capabilityType: CapabilityType;
    /** Event fired when available capabilities from this contribution change */
    readonly onDidChange?: Event<void>;
    /** Returns available capability groups for this type */
    getAvailableCapabilities(): MaybePromise<GenericCapabilityGroup[]>;
}
/**
 * Static mapping of capability types to their corresponding prompt fragment IDs.
 * This is the single source of truth for the enumeration of capability types,
 * reducing DRY violations across the codebase.
 */
export declare const CAPABILITY_TYPE_PROMPT_MAP: ReadonlyArray<{
    type: CapabilityType;
    promptId: string;
}>;
/**
 * Represents user-selected generic capabilities to be included in chat requests.
 * These are capabilities selected via dropdown menus in the chat UI.
 */
export interface GenericCapabilitySelections {
    /** Selected skill IDs */
    skills?: string[];
    /** Selected MCP function IDs (format: "servername_toolname") */
    mcpFunctions?: string[];
    /** Selected function IDs */
    functions?: string[];
    /** Selected prompt fragment IDs */
    promptFragments?: string[];
    /** Selected agent IDs for delegation */
    agentDelegation?: string[];
    /** Selected variable names */
    variables?: string[];
}
export declare namespace GenericCapabilitySelections {
    /**
     * Checks if the selections object has any non-empty arrays.
     */
    function hasSelections(selections: GenericCapabilitySelections | undefined): boolean;
}
/**
 * An extended variable resolution context that includes capability override information.
 *
 * This context is used during prompt template resolution to determine which capability
 * fragments should be enabled or disabled, allowing dynamic customization of agent behavior.
 */
export declare namespace CapabilityAwareContext {
    function is(candidate: unknown): candidate is CapabilityAwareContext;
}
export interface CapabilityAwareContext extends AIVariableContext {
    /**
     * Optional mapping of capability fragment IDs to their enabled/disabled state.
     *
     * When resolving capability variables in prompt templates, this map is consulted
     * to determine whether a capability should be enabled. If a fragment ID is not
     * present in this map, the capability's default state is used.
     */
    capabilityOverrides?: Record<string, boolean>;
    /**
     * Optional generic capability selections from dropdown menus.
     * These selections are used to dynamically include additional capabilities
     * (skills, functions, MCP tools, etc.) in the agent's prompt.
     */
    genericCapabilitySelections?: GenericCapabilitySelections;
}
/**
 * Represents a parsed capability variable from a prompt template.
 */
export interface ParsedCapability {
    /** The fragment ID to resolve when the capability is enabled */
    fragmentId: string;
    /** Whether the capability is enabled by default */
    defaultEnabled: boolean;
    /** Display name for the capability (defaults to fragmentId if not specified) */
    name?: string;
    /** Description of the capability */
    description?: string;
}
/**
 * Parses capability variables from a prompt template string.
 *
 * Capability variables have the format:
 * - `{{capability:fragment-id}}` (defaults to off)
 * - `{{capability:fragment-id default on}}` or `{{capability:fragment-id default off}}`
 * - `{{{capability:fragment-id}}}` (defaults to off)
 * - `{{{capability:fragment-id default on}}}` or `{{{capability:fragment-id default off}}}`
 *
 * @param template The prompt template string to parse
 * @returns Array of parsed capabilities in the order they appear in the template
 */
export declare function parseCapabilitiesFromTemplate(template: string): ParsedCapability[];
/**
 * Parses a capability argument string.
 * Expected formats:
 * - "fragment-id" (defaults to off)
 * - "fragment-id default on" or "fragment-id default off"
 * @param arg The argument string to parse
 * @returns Object with fragmentId and defaultEnabled, or undefined if parsing failed
 */
export declare function parseCapabilityArgument(arg: string): {
    fragmentId: string;
    defaultEnabled: boolean;
} | undefined;
//# sourceMappingURL=capability-utils.d.ts.map