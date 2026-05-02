export declare const TextReplacementContribution: unique symbol;
/**
 * Enables adopters to override text in the application. All `TextReplacementContribution`s need to be bound in the `frontendPreload` scope of the package.json.
 *
 * @example Create a text replacement contribution
 * ```typescript
 *          import { TextReplacementContribution } from '@theia/core/lib/browser/preload/text-replacement-contribution';
 *          export class TextSampleReplacementContribution implements TextReplacementContribution {
 *              getReplacement(locale: string): Record<string, string> {
 *                  switch (locale) {
 *                      case 'en': {
 *                          return {
 *                              'About': 'About Theia',
 *                          };
 *                      }
 *                      case 'de': {
 *                          return {
 *                              'About': 'Über Theia',
 *                          };
 *                      }
 *                  }
 *                  return {};
 *              }
 *          }
 * ```
 */
export interface TextReplacementContribution {
    /**
     * This method returns a map of **default values** and their replacement values for the specified locale.
     * **Do not** use the keys of the `nls.localization` call, but the English default values.
     *
     * @param locale The locale for which the replacement should be returned.
     * @returns A map of default values and their replacement values.
     */
    getReplacement(locale: string): Record<string, string>;
}
//# sourceMappingURL=text-replacement-contribution.d.ts.map