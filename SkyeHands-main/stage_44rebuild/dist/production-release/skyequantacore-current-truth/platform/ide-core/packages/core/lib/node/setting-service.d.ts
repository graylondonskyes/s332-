import { ILogger, URI } from '../common';
import { EnvVariablesServer } from '../common/env-variables';
import { Deferred } from '../common/promise-util';
export declare const SettingService: unique symbol;
/**
 * A service providing a simple user-level, persistent key-value store on the back end
 */
export interface SettingService {
    set(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | undefined>;
}
export declare class SettingServiceImpl implements SettingService {
    protected readonly logger: ILogger;
    protected readonly envVarServer: EnvVariablesServer;
    protected readonly ready: Deferred<void>;
    protected values: Record<string, string>;
    protected init(): void;
    set(key: string, value: string): Promise<void>;
    protected writeFile(): Promise<void>;
    get(key: string): Promise<string | undefined>;
    protected getConfigDirUri(): Promise<URI>;
    protected getSettingsFileUri(): Promise<URI>;
}
//# sourceMappingURL=setting-service.d.ts.map