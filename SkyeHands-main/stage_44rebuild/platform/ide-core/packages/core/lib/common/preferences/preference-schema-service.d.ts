import { Disposable } from '../disposable';
import { Emitter } from '../event';
import { IJSONSchema } from '../json-schema';
import { JSONObject, JSONValue } from '@lumino/coreutils';
import { PreferenceDataProperty, PreferenceSchema, PreferenceSchemaService, DefaultValueChangedEvent, PreferenceContribution } from './preference-schema';
import { PreferenceScope } from './preference-scope';
import { ContributionProvider } from '../contribution-provider';
import { Deferred } from '../promise-util';
export declare const NO_OVERRIDE: {};
export declare const OVERRIDE_PROPERTY = "\\[(.*)\\]$";
export declare class PreferenceSchemaServiceImpl implements PreferenceSchemaService {
    protected readonly schemas: Set<PreferenceSchema>;
    protected readonly properties: Map<string, PreferenceDataProperty>;
    /**
     * This map stores default overrides. The primary map key is the base preference name.
     * The preference name maps to a second map keyed by the override identifier or a special object value `NO_OVERRIDE',
     * representing default overrides for the base property. The value in this second map is an array
     * of entries in reverse order of their insertion. This is necessary becuaus multiple clients might register
     * overrides for the same preference key/override combination. The elements in this array consist of a unique, generated
     * identifier and the actual override value. This allows us to always return the last registerd override even
     * when overrides are later removed.
     */
    protected readonly defaultOverrides: Map<string, Map<string | object, [number, JSONValue][]>>;
    protected readonly _overrideIdentifiers: Set<string>;
    protected readonly jsonSchemas: IJSONSchema[];
    protected readonly _ready: Deferred<void>;
    get ready(): Promise<void>;
    get overrideIdentifiers(): ReadonlySet<string>;
    getSchemaProperties(): ReadonlyMap<string, PreferenceDataProperty>;
    protected nextSchemaTitle: number;
    protected nextOverrideValueId: number;
    protected readonly defaultValueChangedEmitter: Emitter<DefaultValueChangedEvent>;
    protected readonly schemaChangedEmitter: Emitter<void>;
    readonly onDidChangeDefaultValue: import("../event").Event<DefaultValueChangedEvent>;
    readonly onDidChangeSchema: import("../event").Event<void>;
    readonly validScopes: readonly PreferenceScope[];
    protected readonly preferenceContributions: ContributionProvider<PreferenceContribution>;
    protected init(): void;
    dispose(): void;
    registerOverrideIdentifier(overrideIdentifier: string): Disposable;
    addSchema(schema: PreferenceSchema): Disposable;
    isValidInScope(preferenceName: string, scope: PreferenceScope): boolean;
    getSchemaProperty(key: string): PreferenceDataProperty | undefined;
    updateSchemaProperty(key: string, property: PreferenceDataProperty): void;
    protected pendingDefaultRegistrationWarnings: Set<string> | undefined;
    protected logDefaultRegistrationWarnings(): void;
    protected logDefaultRegistrationWarning(key: string): void;
    registerOverride(key: string, overrideIdentifier: string | undefined, value: JSONValue): Disposable;
    protected changeFor(key: string, overrideIdentifier: string | undefined, overrides: Map<string | object, [number, JSONValue][]> | undefined, oldValue: JSONValue | undefined, newValue: JSONValue | undefined): DefaultValueChangedEvent;
    protected removeOverride(key: string, overrideIdentifier: string | undefined, overrideValueId: number): void;
    getDefaultValue(key: string, overrideIdentifier: string | undefined): JSONValue | undefined;
    inspectDefaultValue(key: string, overrideIdentifier: string | undefined): JSONValue | undefined;
    getJSONSchema(scope: PreferenceScope): IJSONSchema;
    protected setJSONSchemasProperty(key: string, property: PreferenceDataProperty): void;
    protected deleteFromJSONSchemas(key: string, property: PreferenceDataProperty): void;
    protected setJSONSchemaProperty(schema: IJSONSchema, key: string, property: PreferenceDataProperty): void;
    addOverrideToJsonSchema(overrideIdentifier: string): void;
    getDefaultValues(): JSONObject;
}
//# sourceMappingURL=preference-schema-service.d.ts.map