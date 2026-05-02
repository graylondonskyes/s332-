import type { AddressInfo } from 'net';
import type { ExtensionInfo } from '../common/application-protocol';
export interface BackendGlobal {
    serverAddress?: Promise<AddressInfo>;
    extensionInfo: ExtensionInfo[];
}
/**
 * The global object for the backend application.
 * Used to store application-wide information.
 *
 * See {@link BackendGlobal} for more details.
 */
export declare const backendGlobal: BackendGlobal;
//# sourceMappingURL=backend-global.d.ts.map