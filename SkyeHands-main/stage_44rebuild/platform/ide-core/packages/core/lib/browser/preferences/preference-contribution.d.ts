import { interfaces } from 'inversify';
import { FrontendApplicationConfig } from '@theia/application-package/lib/application-props';
export declare function bindPreferenceSchemaProvider(bind: interfaces.Bind): void;
/**
 * Specialized {@link FrontendApplicationConfig} to configure default
 * preference values for the {@link PreferenceSchemaProvider}.
 */
export interface FrontendApplicationPreferenceConfig extends FrontendApplicationConfig {
    preferences: {
        [preferenceName: string]: any;
    };
}
export declare namespace FrontendApplicationPreferenceConfig {
    function is(config: FrontendApplicationConfig): config is FrontendApplicationPreferenceConfig;
}
//# sourceMappingURL=preference-contribution.d.ts.map