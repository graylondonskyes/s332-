/**
 * Drop-in replacement for `@theia/monaco-editor-core/esm/vs/nls` that plugs
 * Theia's localization system into every Monaco `localize` / `localize2` call.
 *
 * Webpack resolves the original module to this file via `resolve.alias` (see
 * `webpack-generator.ts`). We import from `nls.messages` directly so the alias
 * does not create a circular reference.
 *
 * The Monaco editor web worker (`editor.worker.js`) is built in a separate
 * webpack config without this alias, so it continues to use the original
 * `nls.js` module and is not affected.
 */
export { getNLSLanguage, getNLSMessages } from '@theia/monaco-editor-core/esm/vs/nls.messages';
import { FormatType } from '@theia/core/lib/common/i18n/localization';
export interface ILocalizeInfo {
    key: string;
    comment: string[];
}
export interface ILocalizedString {
    original: string;
    value: string;
}
export declare function localize(_key: string, label: string, ...args: FormatType[]): string;
export declare function localize2(_key: string, label: string, ...args: FormatType[]): ILocalizedString;
//# sourceMappingURL=monaco-nls.d.ts.map