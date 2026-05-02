import { interfaces } from '@theia/core/shared/inversify';
import { ToolRequest } from './language-model';
import { Event } from '@theia/core';
export declare const ToolInvocationRegistry: unique symbol;
/**
 * Registry for all the function calls available to Agents.
 */
export interface ToolInvocationRegistry {
    /**
     * Registers a tool into the registry.
     *
     * @param tool - The `ToolRequest` object representing the tool to be registered.
     */
    registerTool(tool: ToolRequest): void;
    /**
     * Retrieves a specific `ToolRequest` from the registry.
     *
     * @param toolId - The unique identifier of the tool to retrieve.
     * @returns The `ToolRequest` object corresponding to the provided tool ID,
     *          or `undefined` if the tool is not found in the registry.
     */
    getFunction(toolId: string): ToolRequest | undefined;
    /**
     * Retrieves multiple `ToolRequest`s from the registry.
     *
     * @param toolIds - A list of tool IDs to retrieve.
     * @returns An array of `ToolRequest` objects for the specified tool IDs.
     *          If a tool ID is not found, it is skipped in the returned array.
     */
    getFunctions(...toolIds: string[]): ToolRequest[];
    /**
     * Retrieves all `ToolRequest`s currently registered in the registry.
     *
     * @returns An array of all `ToolRequest` objects in the registry.
     */
    getAllFunctions(): ToolRequest[];
    /**
     * Unregisters all tools provided by a specific tool provider.
     *
     * @param providerName - The name of the tool provider whose tools should be removed (as specificed in the `ToolRequest`).
     */
    unregisterAllTools(providerName: string): void;
    /**
     * Event that is fired whenever the registry changes (tool registered or unregistered).
     */
    onDidChange: Event<void>;
}
export declare const ToolProvider: unique symbol;
export interface ToolProvider {
    getTool(): ToolRequest;
}
/** Binds the identifier to self in singleton scope and then binds `ToolProvider` to that service. */
export declare function bindToolProvider(identifier: interfaces.Newable<ToolProvider>, bind: interfaces.Bind): void;
export declare class ToolInvocationRegistryImpl implements ToolInvocationRegistry {
    private tools;
    private readonly onDidChangeEmitter;
    readonly onDidChange: Event<void>;
    private providers;
    init(): void;
    unregisterAllTools(providerName: string): void;
    getAllFunctions(): ToolRequest[];
    registerTool(tool: ToolRequest): void;
    getFunction(toolId: string): ToolRequest | undefined;
    getFunctions(...toolIds: string[]): ToolRequest[];
}
//# sourceMappingURL=tool-invocation-registry.d.ts.map