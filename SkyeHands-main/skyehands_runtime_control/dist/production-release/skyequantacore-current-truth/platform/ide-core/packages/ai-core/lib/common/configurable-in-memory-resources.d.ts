import { Reference, ResourceResolver, Resource, Event, URI } from '@theia/core';
export declare class ConfigurableInMemoryResources implements ResourceResolver {
    protected readonly resources: any;
    get onWillDispose(): Event<ConfigurableMutableResource>;
    add(uri: URI, options: ResourceInitializationOptions): ConfigurableMutableReferenceResource;
    update(uri: URI, options: ResourceInitializationOptions): Resource;
    resolve(uri: URI): ConfigurableMutableReferenceResource;
    protected acquire(uri: string): ConfigurableMutableReferenceResource;
}
export type ResourceInitializationOptions = Pick<Resource, 'autosaveable' | 'initiallyDirty' | 'readOnly'> & {
    contents?: string | Promise<string>;
    onSave?: Resource['saveContents'];
};
export declare class ConfigurableMutableResource implements Resource {
    readonly uri: URI;
    protected options?: ResourceInitializationOptions | undefined;
    protected readonly onDidChangeContentsEmitter: any;
    readonly onDidChangeContents: any;
    protected fireDidChangeContents(): void;
    protected readonly onDidChangeReadonlyEmitter: any;
    readonly onDidChangeReadOnly: any;
    constructor(uri: URI, options?: ResourceInitializationOptions | undefined);
    get readOnly(): Resource['readOnly'];
    get autosaveable(): boolean;
    get initiallyDirty(): boolean;
    get contents(): string | Promise<string>;
    readContents(): Promise<string>;
    saveContents(contents: string): Promise<void>;
    update(options: ResourceInitializationOptions): void;
    dispose(): void;
}
export declare class ConfigurableMutableReferenceResource implements Resource {
    protected reference: Reference<ConfigurableMutableResource>;
    constructor(reference: Reference<ConfigurableMutableResource>);
    get uri(): URI;
    get onDidChangeContents(): Event<void>;
    dispose(): void;
    readContents(): Promise<string>;
    saveContents(contents: string): Promise<void>;
    update(options: ResourceInitializationOptions): void;
    get readOnly(): Resource['readOnly'];
    get initiallyDirty(): boolean;
    get autosaveable(): boolean;
    get contents(): string | Promise<string>;
}
//# sourceMappingURL=configurable-in-memory-resources.d.ts.map