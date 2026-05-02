import { JSONObject, JSONValue } from '../../../shared/@lumino/coreutils';
import { IJSONSchema, JsonType } from '../../common/json-schema';
import { PreferenceLanguageOverrideService } from '../../common/preferences/preference-language-override-service';
import { PreferenceSchemaService, PreferenceDataProperty } from '../../common/preferences';
export interface PreferenceValidator<T> {
    name: string;
    validate(value: unknown): T;
}
export type ValueValidator = (value: JSONValue) => JSONValue;
export interface PreferenceValidationResult<T extends JSONValue> {
    original: JSONValue | undefined;
    valid: T;
    messages: string[];
}
type ValidatablePreferenceTuple = IJSONSchema & ({
    items: IJSONSchema[];
} | {
    prefixItems: IJSONSchema[];
});
export declare class PreferenceValidationService {
    protected readonly schemaService: PreferenceSchemaService;
    protected readonly languageOverrideService: PreferenceLanguageOverrideService;
    validateOptions(options: Record<string, JSONValue>): Record<string, JSONValue>;
    validateByName(preferenceName: string, value: JSONValue): JSONValue;
    protected doValidateByName(preferenceName: string, value: JSONValue): JSONValue;
    validateBySchema(key: string, value: JSONValue, schema: IJSONSchema | undefined): JSONValue;
    protected getSchema(name: string): IJSONSchema | undefined;
    protected validateMultiple(key: string, value: JSONValue, schema: IJSONSchema & {
        type: JsonType[];
    }): JSONValue;
    protected validateAnyOf(key: string, value: JSONValue, schema: IJSONSchema & {
        anyOf: IJSONSchema[];
    }): JSONValue;
    protected validateOneOf(key: string, value: JSONValue, schema: IJSONSchema & {
        oneOf: IJSONSchema[];
    }): JSONValue;
    protected mapValidators(key: string, value: JSONValue, validators: Iterable<(value: JSONValue) => JSONValue>): JSONValue;
    protected validateArray(key: string, value: JSONValue, schema: IJSONSchema): JSONValue[];
    protected validateTuple(key: string, value: JSONValue, schema: ValidatablePreferenceTuple): JSONValue[];
    protected validateConst(key: string, value: JSONValue, schema: IJSONSchema & {
        const: JSONValue;
    }): JSONValue;
    protected validateEnum(key: string, value: JSONValue, schema: IJSONSchema & {
        enum: JSONValue[];
    }): JSONValue;
    protected validateBoolean(key: string, value: JSONValue, schema: IJSONSchema): boolean;
    protected validateInteger(key: string, value: JSONValue, schema: IJSONSchema): number;
    protected validateNumber(key: string, value: JSONValue, schema: IJSONSchema): number;
    protected validateObject(key: string, value: JSONValue, schema: IJSONSchema): JSONObject;
    protected objectMatchesSchema(key: string, value: JSONValue, schema: IJSONSchema): value is JSONObject;
    protected validateString(key: string, value: JSONValue, schema: IJSONSchema): string;
    protected getDefaultFromSchema(schema: IJSONSchema): JSONValue;
    getDefaultValue(property: PreferenceDataProperty): JSONValue;
}
export {};
//# sourceMappingURL=preference-validation-service.d.ts.map