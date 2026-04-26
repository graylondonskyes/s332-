import type { OPFSFileSystemProvider } from './opfs-filesystem-provider';
export declare const OPFSInitialization: unique symbol;
export interface OPFSInitialization {
    getBroadcastChannel(): BroadcastChannel;
    getRootDirectory(): Promise<string> | string;
    initializeFS(provider: OPFSFileSystemProvider): Promise<void>;
}
export declare class DefaultOPFSInitialization implements OPFSInitialization {
    getBroadcastChannel(): BroadcastChannel;
    getRootDirectory(): Promise<string> | string;
    initializeFS(provider: OPFSFileSystemProvider): Promise<void>;
}
//# sourceMappingURL=opfs-filesystem-initialization.d.ts.map