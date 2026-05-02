"use strict";
// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultPromptFragmentCustomizationService = exports.CustomizationSource = void 0;
exports.getCustomizationSourceString = getCustomizationSourceString;
const tslib_1 = require("tslib");
const core_1 = require("@theia/core");
const browser_1 = require("@theia/core/lib/browser");
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("../common");
const buffer_1 = require("@theia/core/lib/common/buffer");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const ai_core_preferences_1 = require("../common/ai-core-preferences");
const env_variables_1 = require("@theia/core/lib/common/env-variables");
const js_yaml_1 = require("js-yaml");
const prompttemplate_contribution_1 = require("./prompttemplate-contribution");
const prompttemplate_parser_1 = require("./prompttemplate-parser");
/**
 * Default template entry for creating custom agents
 */
const newCustomAgentEntry = {
    id: 'my_agent',
    name: 'My Agent',
    description: core_1.nls.localize('theia/ai/core/customAgentTemplate/description', 'This is an example agent. Please adapt the properties to fit your needs.'),
    prompt: `{{!-- Note: The context section below will resolve all context elements (e.g. files) to their full content
in the system prompt. Context elements can be added by the user in the default chat view (e.g. via DnD or the "+" button).
If you want a more fine-grained, on demand resolvement of context elements, you can also resolve files to their paths only
and equip the agent with functions so that the LLM can retrieve files on demand. See the Coder Agent prompt for an example.--}}

# Role
You are an example agent. Be nice and helpful to the user.

## Current Context
Some files and other pieces of data may have been added by the user to the context of the chat. If any have, the details can be found below.
{{contextDetails}}`,
    defaultLLM: 'openai/gpt-4o',
    showInChat: true
};
var CustomizationSource;
(function (CustomizationSource) {
    CustomizationSource[CustomizationSource["CUSTOMIZED"] = 1] = "CUSTOMIZED";
    CustomizationSource[CustomizationSource["FOLDER"] = 2] = "FOLDER";
    CustomizationSource[CustomizationSource["FILE"] = 3] = "FILE";
})(CustomizationSource || (exports.CustomizationSource = CustomizationSource = {}));
function getCustomizationSourceString(origin) {
    switch (origin) {
        case CustomizationSource.FILE:
            return 'Workspace Template Files';
        case CustomizationSource.FOLDER:
            return 'Workspace Template Directories';
        default:
            return 'Prompt Templates Folder';
    }
}
let DefaultPromptFragmentCustomizationService = class DefaultPromptFragmentCustomizationService {
    constructor() {
        /** Stores URI strings of template files from directories currently being monitored for changes. */
        this.trackedTemplateURIs = new Set();
        /** Contains the currently active customization, mapped by prompt fragment ID. */
        this.activeCustomizations = new Map();
        /** Tracks all loaded customizations, including overridden ones, mapped by source URI. */
        this.allCustomizations = new Map();
        /** Stores additional directory paths for loading template files. */
        this.additionalTemplateDirs = new Set();
        /** Contains file extensions that identify prompt template files. */
        this.templateExtensions = new Set([prompttemplate_contribution_1.PROMPT_TEMPLATE_EXTENSION]);
        /** Stores specific file paths, provided by the settings, that should be treated as templates. */
        this.workspaceTemplateFiles = new Set();
        /** Maps URI strings to WatchedFileInfo objects for individually watched template files. */
        this.watchedFiles = new Map();
        /** Collection of disposable resources for cleanup when the service updates or is disposed. */
        this.toDispose = new core_1.DisposableCollection();
        this.onDidChangePromptFragmentCustomizationEmitter = new core_1.Emitter();
        this.onDidChangePromptFragmentCustomization = this.onDidChangePromptFragmentCustomizationEmitter.event;
        this.onDidChangeCustomAgentsEmitter = new core_1.Emitter();
        this.onDidChangeCustomAgents = this.onDidChangeCustomAgentsEmitter.event;
    }
    init() {
        this.preferences.onPreferenceChanged(event => {
            if (event.preferenceName === ai_core_preferences_1.PREFERENCE_NAME_PROMPT_TEMPLATES) {
                this.update();
            }
        });
        this.update();
    }
    /**
     * Updates the service by reloading all template files and watching for changes
     */
    async update() {
        this.toDispose.dispose();
        // we need to assign local variables, so that updates running in parallel don't interfere with each other
        const activeCustomizationsCopy = new Map();
        const trackedTemplateURIsCopy = new Set();
        const allCustomizationsCopy = new Map();
        const watchedFilesCopy = new Map();
        // Process in order of priority (lowest to highest)
        // First process the main templates directory (lowest priority)
        const templatesURI = await this.getTemplatesDirectoryURI();
        await this.processTemplateDirectory(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, templatesURI, 1, CustomizationSource.CUSTOMIZED); // Priority 1 for customized fragments
        // Process additional template directories (medium priority)
        for (const dirPath of this.additionalTemplateDirs) {
            const dirURI = core_1.URI.fromFilePath(dirPath);
            await this.processTemplateDirectory(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, dirURI, 2, CustomizationSource.FOLDER); // Priority 2 for folder fragments
        }
        // Process specific template files (highest priority)
        await this.processTemplateFiles(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, watchedFilesCopy);
        this.activeCustomizations = activeCustomizationsCopy;
        this.trackedTemplateURIs = trackedTemplateURIsCopy;
        this.allCustomizations = allCustomizationsCopy;
        this.watchedFiles = watchedFilesCopy;
        this.onDidChangeCustomAgentsEmitter.fire();
    }
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
    addTemplate(activeCustomizationsCopy, id, template, sourceUri, allCustomizationsCopy, priority, origin, metadata) {
        // Generate a unique customization ID based on source URI and priority
        const customizationId = this.generateCustomizationId(id, sourceUri);
        // Create customization object with metadata
        const customization = {
            id,
            template,
            sourceUri,
            priority,
            customizationId,
            origin,
            ...(metadata && {
                name: metadata.name,
                description: metadata.description,
                isCommand: metadata.isCommand,
                commandName: metadata.commandName,
                commandDescription: metadata.commandDescription,
                commandArgumentHint: metadata.commandArgumentHint,
                commandAgents: metadata.commandAgents,
            })
        };
        // Always add to allCustomizationsCopy to keep track of all customizations including overridden ones
        if (sourceUri) {
            allCustomizationsCopy.set(sourceUri, customization);
        }
        const existingEntry = activeCustomizationsCopy.get(id);
        if (existingEntry) {
            // If this is an update to the same file (same source URI)
            if (sourceUri && existingEntry.sourceUri === sourceUri) {
                // Update the content while keeping the same priority and source
                activeCustomizationsCopy.set(id, customization);
                return;
            }
            // If the new customization has higher priority, replace the existing one
            if (priority > existingEntry.priority) {
                activeCustomizationsCopy.set(id, customization);
                return;
            }
            else if (priority === existingEntry.priority) {
                // There is a conflict with the same priority, we ignore the new customization
                const conflictSourceUri = existingEntry.sourceUri ? ` (Existing source: ${existingEntry.sourceUri}, New source: ${sourceUri})` : '';
                console.warn(`Fragment conflict detected for ID '${id}' with equal priority.${conflictSourceUri}`);
            }
            return;
        }
        // No conflict at all, add the customization
        activeCustomizationsCopy.set(id, customization);
    }
    /**
     * Generates a unique customization ID based on the fragment ID, source URI, and priority
     * @param id The fragment ID
     * @param sourceUri The source URI of the template
     * @returns A unique customization ID
     */
    generateCustomizationId(id, sourceUri) {
        // Create a customization ID that contains information about the source and priority
        // This ensures uniqueness across different customization sources
        const sourceHash = this.hashString(sourceUri);
        return `${id}_${sourceHash}`;
    }
    /**
     * Simple hash function to generate a short identifier from a string
     * @param str The string to hash
     * @returns A string hash
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 8);
    }
    /**
     * Parses a template file that may contain YAML front matter
     * @param fileContent The raw file content
     * @returns Parsed metadata and template content
     */
    parseTemplateWithMetadata(fileContent) {
        return (0, prompttemplate_parser_1.parseTemplateWithMetadata)(fileContent);
    }
    /**
     * Removes a customization from customizations maps based on the source URI.
     * Also checks for any lower-priority customizations with the same ID that might need to be loaded.
     * @param sourceUri The URI of the source file being removed
     * @param allCustomizationsCopy The map of all loaded customizations
     * @param activeCustomizationsCopy The map of active customizations
     * @param trackedTemplateURIsCopy Optional set of tracked URIs to update
     * @returns The fragment ID that was removed, or undefined if no customization was found
     */
    removeCustomizationFromMaps(sourceUri, allCustomizationsCopy, activeCustomizationsCopy, trackedTemplateURIsCopy) {
        // Get the customization entry from allCustomizationsCopy
        const removedCustomization = allCustomizationsCopy.get(sourceUri);
        if (!removedCustomization) {
            return undefined;
        }
        const fragmentId = removedCustomization.id;
        allCustomizationsCopy.delete(sourceUri);
        trackedTemplateURIsCopy.delete(sourceUri);
        // If the customization is in the active customizations map, we check if there is another customization previously conflicting with it
        const activeCustomization = activeCustomizationsCopy.get(fragmentId);
        if (activeCustomization && activeCustomization.sourceUri === sourceUri) {
            activeCustomizationsCopy.delete(fragmentId);
            // Find any lower-priority customizations with the same ID that were previously ignored
            const lowerPriorityCustomizations = Array.from(allCustomizationsCopy.values())
                .filter(t => t.id === fragmentId)
                .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
            // If there are any lower-priority customizations, add the highest priority one
            if (lowerPriorityCustomizations.length > 0) {
                const highestRemainingCustomization = lowerPriorityCustomizations[0];
                activeCustomizationsCopy.set(fragmentId, highestRemainingCustomization);
            }
        }
        return fragmentId;
    }
    /**
     * Process the template files specified by path, watching for changes
     * and loading their content into the customizations map
     * @param activeCustomizationsCopy Map to store active customizations
     * @param trackedTemplateURIsCopy Set to track URIs being monitored
     * @param allCustomizationsCopy Map to store all loaded customizations
     * @param watchedFilesCopy Map to store file watch information
     */
    async processTemplateFiles(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, watchedFilesCopy) {
        const priority = 3; // Highest priority for specific files
        const parsedPromptFragments = new Set();
        for (const filePath of this.workspaceTemplateFiles) {
            const fileURI = core_1.URI.fromFilePath(filePath);
            const fragmentId = this.getFragmentIdFromFilePath(filePath);
            const uriString = fileURI.toString();
            const customizationId = this.generateCustomizationId(fragmentId, uriString);
            watchedFilesCopy.set(uriString, { uri: fileURI, fragmentId, customizationId });
            this.toDispose.push(this.fileService.watch(fileURI, { recursive: false, excludes: [] }));
            if (await this.fileService.exists(fileURI)) {
                trackedTemplateURIsCopy.add(uriString);
                const fileContent = await this.fileService.read(fileURI);
                const parsed = this.parseTemplateWithMetadata(fileContent.value);
                this.addTemplate(activeCustomizationsCopy, fragmentId, parsed.template, uriString, allCustomizationsCopy, priority, CustomizationSource.FILE, parsed.metadata);
                parsedPromptFragments.add(fragmentId);
            }
        }
        this.onDidChangePromptFragmentCustomizationEmitter.fire(Array.from(parsedPromptFragments));
        this.toDispose.push(this.fileService.onDidFilesChange(async (event) => {
            // Only watch for changes that are in the watchedFiles map
            if (!event.changes.some(change => this.watchedFiles.get(change.resource.toString()))) {
                return;
            }
            // Track changes for batched notification
            const changedFragmentIds = new Set();
            // Handle deleted files
            for (const deletedFile of event.getDeleted()) {
                const fileUriString = deletedFile.resource.toString();
                const fileInfo = this.watchedFiles.get(fileUriString);
                if (fileInfo) {
                    const removedFragmentId = this.removeCustomizationFromMaps(fileUriString, allCustomizationsCopy, activeCustomizationsCopy, trackedTemplateURIsCopy);
                    if (removedFragmentId) {
                        changedFragmentIds.add(removedFragmentId);
                    }
                }
            }
            // Handle updated files
            for (const updatedFile of event.getUpdated()) {
                const fileUriString = updatedFile.resource.toString();
                const fileInfo = this.watchedFiles.get(fileUriString);
                if (fileInfo) {
                    const fileContent = await this.fileService.read(fileInfo.uri);
                    const parsed = this.parseTemplateWithMetadata(fileContent.value);
                    this.addTemplate(this.activeCustomizations, fileInfo.fragmentId, parsed.template, fileUriString, this.allCustomizations, priority, CustomizationSource.FILE, parsed.metadata);
                    changedFragmentIds.add(fileInfo.fragmentId);
                }
            }
            // Handle newly created files
            for (const addedFile of event.getAdded()) {
                const fileUriString = addedFile.resource.toString();
                const fileInfo = this.watchedFiles.get(fileUriString);
                if (fileInfo) {
                    const fileContent = await this.fileService.read(fileInfo.uri);
                    const parsed = this.parseTemplateWithMetadata(fileContent.value);
                    this.addTemplate(this.activeCustomizations, fileInfo.fragmentId, parsed.template, fileUriString, this.allCustomizations, priority, CustomizationSource.FILE, parsed.metadata);
                    this.trackedTemplateURIs.add(fileUriString);
                    changedFragmentIds.add(fileInfo.fragmentId);
                }
            }
            const changedFragmentIdsArray = Array.from(changedFragmentIds);
            if (changedFragmentIdsArray.length > 0) {
                this.onDidChangePromptFragmentCustomizationEmitter.fire(changedFragmentIdsArray);
            }
            ;
        }));
    }
    /**
     * Extract a fragment ID from a file path
     * @param filePath The path to the template file
     * @returns A fragment ID derived from the file name
     */
    getFragmentIdFromFilePath(filePath) {
        const uri = core_1.URI.fromFilePath(filePath);
        return this.removePromptTemplateSuffix(uri.path.name);
    }
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
    async processTemplateDirectory(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, dirURI, priority, customizationSource) {
        const dirExists = await this.fileService.exists(dirURI);
        // Process existing files if directory exists
        if (dirExists) {
            await this.processExistingTemplateDirectory(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, dirURI, priority, customizationSource);
        }
        // Set up file watching for the directory (works for both existing and non-existing directories)
        this.setupDirectoryWatcher(dirURI, priority, customizationSource);
    }
    /**
     * Processes an existing directory for template files
     * @param activeCustomizationsCopy Map to store active customizations
     * @param trackedTemplateURIsCopy Set to track URIs being monitored
     * @param allCustomizationsCopy Map to store all loaded customizations
     * @param dirURI URI of the directory to process
     * @param priority Priority level for customizations in this directory
     * @param customizationSource Source type of the customization
     */
    async processExistingTemplateDirectory(activeCustomizationsCopy, trackedTemplateURIsCopy, allCustomizationsCopy, dirURI, priority, customizationSource) {
        const stat = await this.fileService.resolve(dirURI);
        if (stat.children === undefined) {
            return;
        }
        const parsedPromptFragments = new Set();
        for (const file of stat.children) {
            if (!file.isFile) {
                continue;
            }
            const fileURI = file.resource;
            if (this.isPromptTemplateExtension(fileURI.path.ext)) {
                trackedTemplateURIsCopy.add(fileURI.toString());
                const fileContent = await this.fileService.read(fileURI);
                const parsed = this.parseTemplateWithMetadata(fileContent.value);
                const fragmentId = this.removePromptTemplateSuffix(file.name);
                this.addTemplate(activeCustomizationsCopy, fragmentId, parsed.template, fileURI.toString(), allCustomizationsCopy, priority, customizationSource, parsed.metadata);
                parsedPromptFragments.add(fragmentId);
            }
        }
        this.onDidChangePromptFragmentCustomizationEmitter.fire(Array.from(parsedPromptFragments));
        this.onDidChangeCustomAgentsEmitter.fire();
    }
    /**
     * Sets up file watching for a template directory (works for both existing and non-existing directories)
     * @param dirURI URI of the directory to watch
     * @param priority Priority level for customizations in this directory
     * @param customizationSource Source type of the customization
     */
    setupDirectoryWatcher(dirURI, priority, customizationSource) {
        this.toDispose.push(this.fileService.watch(dirURI, { recursive: true, excludes: [] }));
        this.toDispose.push(this.fileService.onDidFilesChange(async (event) => {
            // Filter for changes within the watched directory
            if (!event.changes.some(change => change.resource.toString().startsWith(dirURI.toString()))) {
                return;
            }
            // Handle directory creation or deletion (when watching a previously non-existent directory)
            if (event.getAdded().some(addedFile => addedFile.resource.toString() === dirURI.toString()) ||
                event.getDeleted().some(deletedFile => deletedFile.resource.toString() === dirURI.toString())) {
                // Directory was created or deleted, restart the update process to handle the change
                await this.update();
                return;
            }
            if (event.changes.some(change => change.resource.toString().endsWith('customAgents.yml'))) {
                this.onDidChangeCustomAgentsEmitter.fire();
            }
            // Track changes for batched notification
            const changedFragmentIds = new Set();
            // Handle deleted templates
            for (const deletedFile of event.getDeleted()) {
                const uriString = deletedFile.resource.toString();
                if (this.trackedTemplateURIs.has(uriString)) {
                    const removedFragmentId = this.removeCustomizationFromMaps(uriString, this.allCustomizations, this.activeCustomizations, this.trackedTemplateURIs);
                    if (removedFragmentId) {
                        changedFragmentIds.add(removedFragmentId);
                    }
                }
            }
            // Handle updated templates
            for (const updatedFile of event.getUpdated()) {
                const uriString = updatedFile.resource.toString();
                if (this.trackedTemplateURIs.has(uriString)) {
                    const fileContent = await this.fileService.read(updatedFile.resource);
                    const parsed = this.parseTemplateWithMetadata(fileContent.value);
                    const fragmentId = this.removePromptTemplateSuffix(updatedFile.resource.path.name);
                    this.addTemplate(this.activeCustomizations, fragmentId, parsed.template, uriString, this.allCustomizations, priority, customizationSource, parsed.metadata);
                    changedFragmentIds.add(fragmentId);
                }
            }
            // Handle new templates
            for (const addedFile of event.getAdded()) {
                if (addedFile.resource.parent.toString() === dirURI.toString() &&
                    this.isPromptTemplateExtension(addedFile.resource.path.ext)) {
                    const uriString = addedFile.resource.toString();
                    this.trackedTemplateURIs.add(uriString);
                    const fileContent = await this.fileService.read(addedFile.resource);
                    const parsed = this.parseTemplateWithMetadata(fileContent.value);
                    const fragmentId = this.removePromptTemplateSuffix(addedFile.resource.path.name);
                    this.addTemplate(this.activeCustomizations, fragmentId, parsed.template, uriString, this.allCustomizations, priority, customizationSource, parsed.metadata);
                    changedFragmentIds.add(fragmentId);
                }
            }
            const changedFragmentIdsArray = Array.from(changedFragmentIds);
            if (changedFragmentIdsArray.length > 0) {
                this.onDidChangePromptFragmentCustomizationEmitter.fire(changedFragmentIdsArray);
            }
        }));
    }
    /**
     * Checks if the given file extension is registered as a prompt template extension
     * @param extension The file extension including the leading dot (e.g., '.prompttemplate')
     * @returns True if the extension is registered as a prompt template extension
     */
    isPromptTemplateExtension(extension) {
        return this.templateExtensions.has(extension);
    }
    /**
     * Gets the list of additional template directories that are being watched.
     * @returns Array of directory paths
     */
    getAdditionalTemplateDirectories() {
        return Array.from(this.additionalTemplateDirs);
    }
    /**
     * Gets the list of file extensions that are considered prompt templates.
     * @returns Array of file extensions including the leading dot (e.g., '.prompttemplate')
     */
    getTemplateFileExtensions() {
        return Array.from(this.templateExtensions);
    }
    /**
     * Gets the list of specific template files that are being watched.
     * @returns Array of file paths
     */
    getTemplateFiles() {
        return Array.from(this.workspaceTemplateFiles);
    }
    /**
     * Updates multiple configuration properties at once, triggering only a single update process.
     * @param properties An object containing the properties to update
     * @returns Promise that resolves when the update is complete
     */
    async updateConfiguration(properties) {
        if (properties.directoryPaths !== undefined) {
            this.additionalTemplateDirs.clear();
            for (const path of properties.directoryPaths) {
                this.additionalTemplateDirs.add(path);
            }
        }
        if (properties.extensions !== undefined) {
            this.templateExtensions.clear();
            for (const ext of properties.extensions) {
                this.templateExtensions.add(ext);
            }
            // Always include the default PROMPT_TEMPLATE_EXTENSION
            this.templateExtensions.add(prompttemplate_contribution_1.PROMPT_TEMPLATE_EXTENSION);
        }
        if (properties.filePaths !== undefined) {
            this.workspaceTemplateFiles.clear();
            for (const path of properties.filePaths) {
                this.workspaceTemplateFiles.add(path);
            }
        }
        // Only run the update process once, no matter how many properties were changed
        await this.update();
    }
    /**
     * Gets the URI of the templates directory
     * @returns URI of the templates directory
     */
    async getTemplatesDirectoryURI() {
        const templatesFolder = this.preferences[ai_core_preferences_1.PREFERENCE_NAME_PROMPT_TEMPLATES];
        if (templatesFolder && templatesFolder.trim().length > 0) {
            return core_1.URI.fromFilePath(templatesFolder);
        }
        const theiaConfigDir = await this.envVariablesServer.getConfigDirUri();
        return new core_1.URI(theiaConfigDir).resolve('prompt-templates');
    }
    /**
     * Gets the URI for a specific template file
     * @param fragmentId The fragment ID
     * @returns URI for the template file
     */
    async getTemplateURI(fragmentId) {
        return (await this.getTemplatesDirectoryURI()).resolve(`${fragmentId}${prompttemplate_contribution_1.PROMPT_TEMPLATE_EXTENSION}`);
    }
    /**
     * Removes the prompt template extension from a filename
     * @param filename The filename with extension
     * @returns The filename without the extension
     */
    removePromptTemplateSuffix(filename) {
        for (const ext of this.templateExtensions) {
            if (filename.endsWith(ext)) {
                return filename.slice(0, -ext.length);
            }
        }
        return filename;
    }
    // PromptFragmentCustomizationService interface implementation
    isPromptFragmentCustomized(id) {
        return this.activeCustomizations.has(id);
    }
    getActivePromptFragmentCustomization(id) {
        const entry = this.activeCustomizations.get(id);
        if (!entry) {
            return undefined;
        }
        return {
            id: entry.id,
            template: entry.template,
            customizationId: entry.customizationId,
            priority: entry.priority,
            // Pass through fragment metadata
            name: entry.name,
            description: entry.description,
            isCommand: entry.isCommand,
            commandName: entry.commandName,
            commandDescription: entry.commandDescription,
            commandArgumentHint: entry.commandArgumentHint,
            commandAgents: entry.commandAgents,
        };
    }
    getAllCustomizations(id) {
        const fragments = [];
        // Collect all customizations with matching ID
        this.allCustomizations.forEach(value => {
            if (value.id === id) {
                fragments.push({
                    id: value.id,
                    template: value.template,
                    customizationId: value.customizationId,
                    priority: value.priority,
                    // Pass through fragment metadata
                    name: value.name,
                    description: value.description,
                    isCommand: value.isCommand,
                    commandName: value.commandName,
                    commandDescription: value.commandDescription,
                    commandArgumentHint: value.commandArgumentHint,
                    commandAgents: value.commandAgents,
                });
            }
        });
        // Sort by priority (highest first)
        return fragments.sort((a, b) => b.priority - a.priority);
    }
    getCustomizedPromptFragmentIds() {
        return Array.from(this.activeCustomizations.keys());
    }
    async createPromptFragmentCustomization(id, defaultContent) {
        await this.editTemplate(id, defaultContent);
    }
    async createBuiltInPromptFragmentCustomization(id, defaultContent) {
        await this.createPromptFragmentCustomization(id, defaultContent);
    }
    async editPromptFragmentCustomization(id, customizationId) {
        // Find the customization with the given customization ID
        const customization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customizationId);
        if (customization) {
            const uri = new core_1.URI(customization.sourceUri);
            const openHandler = await this.openerService.getOpener(uri);
            openHandler.open(uri);
        }
        else {
            // Fall back to editing by fragment ID if customization ID not found
            await this.editTemplate(id);
        }
    }
    /**
     * Edits a template by opening it in the editor, creating it if it doesn't exist
     * @param id The fragment ID
     * @param defaultContent Optional default content for new templates
     */
    async editTemplate(id, defaultContent) {
        const editorUri = await this.getTemplateURI(id);
        if (!(await this.fileService.exists(editorUri))) {
            await this.fileService.createFile(editorUri, buffer_1.BinaryBuffer.fromString(defaultContent ?? ''));
        }
        const openHandler = await this.openerService.getOpener(editorUri);
        openHandler.open(editorUri);
    }
    async removePromptFragmentCustomization(id, customizationId) {
        // Find the customization with the given customization ID
        const customization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customizationId);
        if (customization) {
            const sourceUri = customization.sourceUri;
            // Delete the file if it exists
            const uri = new core_1.URI(sourceUri);
            if (await this.fileService.exists(uri)) {
                await this.fileService.delete(uri);
            }
        }
    }
    async removeAllPromptFragmentCustomizations(id) {
        // Get all customizations for this fragment ID
        const customizations = this.getAllCustomizations(id);
        if (customizations.length === 0) {
            return; // Nothing to reset
        }
        // Find and delete all customization files
        for (const customization of customizations) {
            const fragment = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customization.customizationId);
            if (fragment) {
                const sourceUri = fragment.sourceUri;
                // Delete the file if it exists
                const uri = new core_1.URI(sourceUri);
                if (await this.fileService.exists(uri)) {
                    await this.fileService.delete(uri);
                }
            }
        }
    }
    async resetToCustomization(id, customizationId) {
        const customization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customizationId);
        if (customization) {
            // Get all customizations for this fragment ID
            const customizations = this.getAllCustomizations(id);
            if (customizations.length === 0) {
                return; // Nothing to reset
            }
            // Find the target customization
            const targetCustomization = customizations.find(c => c.customizationId === customizationId);
            if (!targetCustomization) {
                return; // Target customization not found
            }
            // Find and delete all higher-priority customization files
            for (const cust of customizations) {
                if (cust.priority > targetCustomization.priority) {
                    const fragmentToDelete = Array.from(this.allCustomizations.values()).find(t => t.id === cust.id && t.customizationId === cust.customizationId);
                    if (fragmentToDelete) {
                        const sourceUri = fragmentToDelete.sourceUri;
                        // Delete the file if it exists
                        const uri = new core_1.URI(sourceUri);
                        if (await this.fileService.exists(uri)) {
                            await this.fileService.delete(uri);
                        }
                    }
                }
            }
        }
    }
    async getPromptFragmentCustomizationDescription(id, customizationId) {
        // Find the customization with the given customization ID
        const customization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customizationId);
        if (customization) {
            return customization.sourceUri;
        }
        return undefined;
    }
    async getPromptFragmentCustomizationType(id, customizationId) {
        // Find the customization with the given customization ID
        const customization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.customizationId === customizationId);
        if (customization) {
            return getCustomizationSourceString(customization.origin);
        }
        return undefined;
    }
    async editBuiltIn(id, defaultContent = '') {
        // Find an existing built-in customization (those with priority 1)
        const builtInCustomization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.priority === 1);
        if (builtInCustomization) {
            // Edit the existing built-in customization
            const uri = new core_1.URI(builtInCustomization.sourceUri);
            const openHandler = await this.openerService.getOpener(uri);
            openHandler.open(uri);
        }
        else {
            // Create a new built-in customization
            // Get the template URI in the main templates directory (priority 1)
            const templateUri = await this.getTemplateURI(id);
            // If template doesn't exist, create it with default content
            if (!(await this.fileService.exists(templateUri))) {
                await this.fileService.createFile(templateUri, buffer_1.BinaryBuffer.fromString(defaultContent));
            }
            // Open the template in the editor
            const openHandler = await this.openerService.getOpener(templateUri);
            openHandler.open(templateUri);
        }
    }
    async resetBuiltInCustomization(id) {
        // Find a built-in customization (those with priority 1)
        const builtInCustomization = Array.from(this.allCustomizations.values()).find(t => t.id === id && t.priority === 1);
        if (!builtInCustomization) {
            return; // No built-in customization found
        }
        const sourceUri = builtInCustomization.sourceUri;
        // Delete the file if it exists
        const uri = new core_1.URI(sourceUri);
        if (await this.fileService.exists(uri)) {
            await this.fileService.delete(uri);
        }
    }
    async editBuiltInPromptFragmentCustomization(id, defaultContent) {
        return this.editBuiltIn(id, defaultContent);
    }
    /**
     * Gets the fragment ID from a URI
     * @param uri URI to check
     * @returns Fragment ID or undefined if not found
     */
    getFragmentIDFromURI(uri) {
        const id = this.removePromptTemplateSuffix(uri.path.name);
        if (this.activeCustomizations.has(id)) {
            return id;
        }
        return undefined;
    }
    /**
     * Implementation of the generic getPromptFragmentIDFromResource method in the interface
     * Accepts any resource identifier but only processes URIs
     * @param resourceId Resource to check
     * @returns Fragment ID or undefined if not found
     */
    getPromptFragmentIDFromResource(resourceId) {
        // Check if the resource is a URI
        if (resourceId instanceof core_1.URI) {
            return this.getFragmentIDFromURI(resourceId);
        }
        return undefined;
    }
    async getCustomAgents() {
        const agentsById = new Map();
        // First, process additional (workspace) template directories to give them precedence
        for (const dirPath of this.additionalTemplateDirs) {
            const dirURI = core_1.URI.fromFilePath(dirPath);
            await this.loadCustomAgentsFromDirectory(dirURI, agentsById);
        }
        // Then process global templates directory (only adding agents that don't conflict)
        const globalTemplatesDir = await this.getTemplatesDirectoryURI();
        await this.loadCustomAgentsFromDirectory(globalTemplatesDir, agentsById);
        // Return the merged list of agents
        return Array.from(agentsById.values());
    }
    /**
     * Load custom agents from a specific directory
     * @param directoryURI The URI of the directory to load from
     * @param agentsById Map to store the loaded agents by ID
     */
    async loadCustomAgentsFromDirectory(directoryURI, agentsById) {
        const customAgentYamlUri = directoryURI.resolve('customAgents.yml');
        const yamlExists = await this.fileService.exists(customAgentYamlUri);
        if (!yamlExists) {
            return;
        }
        try {
            const fileContent = await this.fileService.read(customAgentYamlUri, { encoding: 'utf-8' });
            const doc = (0, js_yaml_1.load)(fileContent.value);
            if (!Array.isArray(doc) || !doc.every(entry => common_1.CustomAgentDescription.is(entry))) {
                console.debug(`Invalid customAgents.yml file content in ${directoryURI.toString()}`);
                return;
            }
            const readAgents = doc;
            // Add agents to the map if they don't already exist
            for (const agent of readAgents) {
                if (!agentsById.has(agent.id)) {
                    agentsById.set(agent.id, agent);
                }
            }
        }
        catch (e) {
            console.debug(`Error loading customAgents.yml from ${directoryURI.toString()}: ${e.message}`, e);
        }
    }
    /**
     * Returns all locations of existing customAgents.yml files and potential locations where
     * new customAgents.yml files could be created.
     *
     * @returns An array of objects containing the URI and whether the file exists
     */
    async getCustomAgentsLocations() {
        const locations = [];
        // Check global templates directory
        const globalTemplatesDir = await this.getTemplatesDirectoryURI();
        const globalAgentsUri = globalTemplatesDir.resolve('customAgents.yml');
        const globalExists = await this.fileService.exists(globalAgentsUri);
        locations.push({ uri: globalAgentsUri, exists: globalExists });
        // Check additional (workspace) template directories
        for (const dirPath of this.additionalTemplateDirs) {
            const dirURI = core_1.URI.fromFilePath(dirPath);
            const agentsUri = dirURI.resolve('customAgents.yml');
            const exists = await this.fileService.exists(agentsUri);
            locations.push({ uri: agentsUri, exists: exists });
        }
        return locations;
    }
    /**
     * Opens an existing customAgents.yml file at the given URI, or creates a new one if it doesn't exist.
     *
     * @param uri The URI of the customAgents.yml file to open or create
     */
    async openCustomAgentYaml(uri) {
        const content = (0, js_yaml_1.dump)([newCustomAgentEntry]);
        if (!await this.fileService.exists(uri)) {
            await this.fileService.createFile(uri, buffer_1.BinaryBuffer.fromString(content));
        }
        else {
            const fileContent = (await this.fileService.readFile(uri)).value;
            await this.fileService.writeFile(uri, buffer_1.BinaryBuffer.concat([fileContent, buffer_1.BinaryBuffer.fromString(content)]));
        }
        const openHandler = await this.openerService.getOpener(uri);
        openHandler.open(uri);
    }
};
exports.DefaultPromptFragmentCustomizationService = DefaultPromptFragmentCustomizationService;
tslib_1.__decorate([
    (0, inversify_1.inject)(env_variables_1.EnvVariablesServer),
    tslib_1.__metadata("design:type", typeof (_a = typeof env_variables_1.EnvVariablesServer !== "undefined" && env_variables_1.EnvVariablesServer) === "function" ? _a : Object)
], DefaultPromptFragmentCustomizationService.prototype, "envVariablesServer", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(ai_core_preferences_1.AICorePreferences),
    tslib_1.__metadata("design:type", typeof (_b = typeof ai_core_preferences_1.AICorePreferences !== "undefined" && ai_core_preferences_1.AICorePreferences) === "function" ? _b : Object)
], DefaultPromptFragmentCustomizationService.prototype, "preferences", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    tslib_1.__metadata("design:type", typeof (_c = typeof file_service_1.FileService !== "undefined" && file_service_1.FileService) === "function" ? _c : Object)
], DefaultPromptFragmentCustomizationService.prototype, "fileService", void 0);
tslib_1.__decorate([
    (0, inversify_1.inject)(browser_1.OpenerService),
    tslib_1.__metadata("design:type", typeof (_d = typeof browser_1.OpenerService !== "undefined" && browser_1.OpenerService) === "function" ? _d : Object)
], DefaultPromptFragmentCustomizationService.prototype, "openerService", void 0);
tslib_1.__decorate([
    (0, inversify_1.postConstruct)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], DefaultPromptFragmentCustomizationService.prototype, "init", null);
exports.DefaultPromptFragmentCustomizationService = DefaultPromptFragmentCustomizationService = tslib_1.__decorate([
    (0, inversify_1.injectable)()
], DefaultPromptFragmentCustomizationService);
//# sourceMappingURL=frontend-prompt-customization-service.js.map