import { interfaces } from '@theia/core/shared/inversify';
import { PreferenceProxy, PreferenceSchema, PreferenceService } from '@theia/core/lib/common';
export declare const ProblemConfigSchema: PreferenceSchema;
export interface ProblemConfiguration {
    'problems.decorations.enabled': boolean;
    'problems.decorations.tabbar.enabled': boolean;
    'problems.autoReveal': boolean;
}
export declare const ProblemPreferenceContribution: unique symbol;
export declare const ProblemPreferences: unique symbol;
export type ProblemPreferences = PreferenceProxy<ProblemConfiguration>;
export declare function createProblemPreferences(preferences: PreferenceService, schema?: PreferenceSchema): ProblemPreferences;
export declare const bindProblemPreferences: (bind: interfaces.Bind) => void;
//# sourceMappingURL=problem-preferences.d.ts.map