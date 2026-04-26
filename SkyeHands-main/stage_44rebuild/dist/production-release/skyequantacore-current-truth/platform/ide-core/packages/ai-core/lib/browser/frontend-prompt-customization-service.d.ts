import { URI, Event } from '@theia/core';
import { OpenerService } from '@theia/core/lib/browser';
import { PromptFragmentCustomizationService, CustomAgentDescription, CustomizedPromptFragment, CommandPromptFragmentMetadata } from '../common';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { AICorePreferences } from '../common/ai-core-preferences';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { ParsedTemplate } from './prompttemplate-parser';
export declare enum CustomizationSource {
    CUSTOMIZED = 1,
    FOLDER = 2,
    FILE = 3
}
export declare function getCustomizationSourceString(origin: CustomizationSource): string;
/**
 * Interface defining properties that can be updated in the customization service
 */
export interface PromptFragmentCustomizationProperties {
    /** Array of directory paths to load templates from */
    directoryPaths?: string[];
    /** Array of file paths to treat as templates */
    filePaths?: string[];
    /** Array of file extensions to consider as template files */
    extensions?: string[];
}
/**
 * Internal representation of a fragment entry in the customization service
 * Extends TemplateMetadata to include command-related properties
 */
interface PromptFragmentCustomization extends CommandPromptFragmentMetadata {
    /** The template content */
    template: string;
    /** Source URI where this template is stored */
    sourceUri: string;
    /** Source type of the customization */
    origin: CustomizationSource;
    /** Priority level (higher values override lower ones) */
    priority: number;
    /** Fragment ID */
    id: string;
    /** Unique customization ID */
    customizationId: string;
}
/**
 * Information about a template file being watched for changes
 */
interface WatchedFileInfo {
    /** The URI of the watched file */
    uri: URI;
    /** The fragment ID associated with this file */
    fragmentId: string;
    /** The customization ID for this file */
    customizationId: string;
}
export declare class DefaultPromptFragmentCustomizationService implements PromptFragmentCustomizationService {
    protected readonly envVariablesServer: EnvVariablesServer;
    protected readonly preferences: AICorePreferences;
    protected readonly fileService: FileService;
    protected readonly openerService: OpenerService;
    /** Stores URI strings of template files from directories currently being monitored for changes. */
    protected trackedTemplateURIs: Set<string>;
    /** Contains the currently active customization, mapped by prompt fragment ID. */
    protected activeCustomizations: Map<string, PromptFragmentCustomization>;
    /** Tracks all loaded customizations, including overridden ones, mapped by source URI. */
    protected allCustomizations: Map<string, PromptFragmentCustomization>;
    /** Stores additional directory paths for loading template files. */
    protected additionalTemplateDirs: Set<string>;
    /** Contains file extensions that identify prompt template files. */
    protected templateExtensions: Set<string>;
    /** Stores specific file paths, provided by the settings, that should be treated as templates. */
    protected workspaceTemplateFiles: Set<string>;
    /** Maps URI strings to WatchedFileInfo objects for individually watched template files. */
    protected watchedFiles: Map<string, WatchedFileInfo>;
    /** Collection of disposable resources for cleanup when the service updates or is disposed. */
    protected toDispose: any;
    protected readonly onDidChangePromptFragmentCustomizationEmitter: any;
    readonly onDidChangePromptFragmentCustomization: Event<string[]>;
    protected readonly onDidChangeCustomAgentsEmitter: any;
    readonly onDidChangeCustomAgents: Event<void>;
    protected init(): void;
    /**
     * Updates the service by reloading all template files and watching for changes
     */
    protected update(): Promise<void>;
    /**
     * Adds a template to the customizations map, handling conflicts based on priority
     * @param activeCustomizationsCopy The map to add the customization to
     * @param id The fragment ID
     * @param template The template content
     * @param sourceUri The URI of the source file (used to distinguish updates from conflicts)
     * @param allCustomizationsCopy The map to track all loaded customizations
     * @param priority The customization priority
     * @param origin The source type of the customization
     * @param metadata Optional command metadata
     */
    protected addTemplate(activeCustomizationsCopy: Map<string, PromptFragmentCustomization>, id: string, template: string, sourceUri: string, allCustomizationsCopy: Map<string, PromptFragmentCustomization>, priority: number, origin: CustomizationSource, metadata?: CommandPromptFragmentMetadata): void;
    /**
     * Generates a unique customization ID based on the fragment ID, source URI, and priority
     * @param id The fragment ID
     * @param sourceUri The source URI of the template
     * @returns A unique customization ID
     */
    protected generateCustomizationId(id: string, sourceUri: string): string;
    /**
     * Simple hash function to generate a short identifier from a string
     * @param str The string to hash
     * @returns A string hash
     */
    protected hashString(str: string): string;
    /**
     * Parses a template file that may contain YAML front matter
     * @param fileContent The raw file content
     * @returns Parsed metadata and template content
     */
    protected parseTemplateWithMetadata(fileContent: string): ParsedTemplate;
    /**
     * Removes a customization from customizations maps based on the source URI.
     * Also checks for any lower-priority customizations with the same ID that might need to be loaded.
     * @param sourceUri The URI of the source file being removed
     * @param allCustomizationsCopy The map of all loaded customizations
     * @param activeCustomizationsCopy The map of active customizations
     * @param trackedTemplateURIsCopy Optional set of tracked URIs to update
     * @returns The fragment ID that was removed, or undefined if no customization was found
     */
    protected removeCustomizationFromMaps(sourceUri: string, allCustomizationsCopy: Map<string, PromptFragmentCustomization>, activeCustomizationsCopy: Map<string, PromptFragmentCustomization>, trackedTemplateURIsCopy: Set<string>): string | undefined;
    /**
     * Process the template files specified by path, watching for changes
     * and loading their content into the customizations map
     * @param activeCustomizationsCopy Map to store active customizations
     * @param trackedTemplateURIsCopy Set to track URIs being monitored
     * @param allCustomizationsCopy Map to store all loaded customizations
     * @param watchedFilesCopy Map to store file watch information
     */
    protected processTemplateFiles(activeCustomizationsCopy: Map<string, PromptFragmentCustomization>, trackedTemplateURIsCopy: Set<string>, allCustomizationsCopy: Map<string, PromptFragmentCustomization>, watchedFilesCopy: Map<string, WatchedFileInfo>): Promise<void>;
    /**
     * Extract a fragment ID from a file path
     * @param filePath The path to the template file
     * @returns A fragment ID derived from the file name
     */
    protected getFragmentIdFromFilePath(filePath: string): string;
    /**
     * Processes a directory for template files, adding them to the customizations map
     * and setting up file watching
     * @param activeCustomizationsCopy Map to store active customizations
     * @param trackedTemplateURIsCopy Set to track URIs being monitored
     * @param allCustomizationsCopy Map to store all loaded customizations
     * @param dirURI URI of the directory to process
     * @param priority Priority level for customizations in this directory
     * @param customizationSource Source type of the customization
     */
    protected processTemplateDirectory(activeCustomizationsCopy: Map<string, PromptFragmentCustomization>, trackedTemplateURIsCopy: Set<string>, allCustomizationsCopy: Map<string, PromptFragmentCustomization>, dirURI: URI, priority: number, customizationSource: CustomizationSource): Promise<void>;
    /**
     * Processes an existing directory for template files
     * @param activeCustomizationsCopy Map to store active customizations
     * @param trackedTemplateURIsCopy Set to track URIs being monitored
     * @param allCustomizationsCopy Map to store all loaded customizations
     * @param dirURI URI of the directory to process
     * @param priority Priority level for customizations in this directory
     * @param customizationSource Source type of the customization
     */
    protected processExistingTemplateDirectory(activeCustomizationsCopy: Map<string, PromptFragmentCustomization>, trackedTemplateURIsCopy: Set<string>, allCustomizationsCopy: Map<string, PromptFragmentCustomization>, dirURI: URI, priority: number, customizationSource: CustomizationSource): Promise<void>;
    /**
     * Sets up file watching for a template directory (works for both existing and non-existing directories)
     * @param dirURI URI of the directory to watch
     * @param priority Priority level for customizations in this directory
     * @param customizationSource Source type of the customization
     */
    protected setupDirectoryWatcher(dirURI: URI, priority: number, customizationSource: CustomizationSource): void;
    /**
     * Checks if the given file extension is registered as a prompt template extension
     * @param extension The file extension including the leading dot (e.g., '.prompttemplate')
     * @returns True if the extension is registered as a prompt template extension
     */
    protected isPromptTemplateExtension(extension: string): boolean;
    /**
     * Gets the list of additional template directories that are being watched.
     * @returns Array of directory paths
     */
    getAdditionalTemplateDirectories(): string[];
    /**
     * Gets the list of file extensions that are considered prompt templates.
     * @returns Array of file extensions including the leading dot (e.g., '.prompttemplate')
     */
    getTemplateFileExtensions(): string[];
    /**
     * Gets the list of specific template files that are being watched.
     * @returns Array of file paths
     */
    getTemplateFiles(): string[];
    /**
     * Updates multiple configuration properties at once, triggering only a single update process.
     * @param properties An object containing the properties to update
     * @returns Promise that resolves when the update is complete
     */
    updateConfiguration(properties: PromptFragmentCustomizationProperties): Promise<void>;
    /**
     * Gets the URI of the templates directory
     * @returns URI of the templates directory
     */
    protected getTemplatesDirectoryURI(): Promise<URI>;
    /**
     * Gets the URI for a specific template file
     * @param fragmentId The fragment ID
     * @returns URI for the template file
     */
    protected getTemplateURI(fragmentId: string): Promise<URI>;
    /**
     * Removes the prompt template extension from a filename
     * @param filename The filename with extension
     * @returns The filename without the extension
     */
    protected removePromptTemplateSuffix(filename: string): string;
    isPromptFragmentCustomized(id: string): boolean;
    getActivePromptFragmentCustomization(id: string): CustomizedPromptFragment | undefined;
    getAllCustomizations(id: string): CustomizedPromptFragment[];
    getCustomizedPromptFragmentIds(): string[];
    createPromptFragmentCustomization(id: string, defaultContent?: string): Promise<void>;
    createBuiltInPromptFragmentCustomization(id: string, defaultContent?: string): Promise<void>;
    editPromptFragmentCustomization(id: string, customizationId: string): Promise<void>;
    /**
     * Edits a template by opening it in the editor, creating it if it doesn't exist
     * @param id The fragment ID
     * @param defaultContent Optional default content for new templates
     */
    protected editTemplate(id: string, defaultContent?: string): Promise<void>;
    removePromptFragmentCustomization(id: string, customizationId: string): Promise<void>;
    removeAllPromptFragmentCustomizations(id: string): Promise<void>;
    resetToCustomization(id: string, customizationId: string): Promise<void>;
    getPromptFragmentCustomizationDescription(id: string, customizationId: string): Promise<string | undefined>;
    getPromptFragmentCustomizationType(id: string, customizationId: string): Promise<string | undefined>;
    editBuiltIn(id: string, defaultContent?: string): Promise<void>;
    resetBuiltInCustomization(id: string): Promise<void>;
    editBuiltInPromptFragmentCustomization(id: string, defaultContent?: string): Promise<void>;
    /**
     * Gets the fragment ID from a URI
     * @param uri URI to check
     * @returns Fragment ID or undefined if not found
     */
    protected getFragmentIDFromURI(uri: URI): string | undefined;
    /**
     * Implementation of the generic getPromptFragmentIDFromResource method in the interface
     * Accepts any resource identifier but only processes URIs
     * @param resourceId Resource to check
     * @returns Fragment ID or undefined if not found
     */
    getPromptFragmentIDFromResource(resourceId: unknown): string | undefined;
    getCustomAgents(): Promise<CustomAgentDescription[]>;
    /**
     * Load custom agents from a specific directory
     * @param directoryURI The URI of the directory to load from
     * @param agentsById Map to store the loaded agents by ID
     */
    protected loadCustomAgentsFromDirectory(directoryURI: URI, agentsById: Map<string, CustomAgentDescription>): Promise<void>;
    /**
     * Returns all locations of existing customAgents.yml files and potential locations where
     * new customAgents.yml files could be created.
     *
     * @returns An array of objects containing the URI and whether the file exists
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
export {};
//# sourceMappingURL=frontend-prompt-customization-service.d.ts.map