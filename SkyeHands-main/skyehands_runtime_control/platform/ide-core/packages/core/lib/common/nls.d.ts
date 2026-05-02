import { FormatType, Localization } from './i18n/localization';
export declare namespace nls {
    let localization: Localization | undefined;
    const defaultLocale = "en";
    const localeId = "localeId";
    const locale: string | undefined;
    /**
     * Automatically localizes a text if that text also exists in the vscode repository.
     */
    function localizeByDefault(defaultValue: string, ...args: FormatType[]): string;
    function getDefaultKey(defaultValue: string): string;
    function localize(key: string, defaultValue: string, ...args: FormatType[]): string;
    function isSelectedLocale(id: string): boolean;
    function setLocale(id: string): void;
    /**
     * Sets the 'lang' attribute on the given HTML element based on the current locale.
     * If no locale is set, defaults to 'en' (English).
     * Typically used with document.documentElement (the <html> tag) to set the page language.
     *
     * @param element The HTML element to set the language attribute on
     */
    function setHtmlLang(element: HTMLElement): void;
    /**
     * Sets the 'translate' attribute to 'no' and adds the 'notranslate' class
     * to the given HTML element. This prevents translation tools from translating
     * the content of the element.
     * Typically used with document.documentElement (the <html> tag) to disable page translation.
     *
     * @param element The HTML element to set translation attributes on
     */
    function setHtmlNoTranslate(element: HTMLElement): void;
}
//# sourceMappingURL=nls.d.ts.map