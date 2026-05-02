import { PreloadContribution } from './preloader';
import { LocalizationServer } from '../../common/i18n/localization-server';
import { ContributionProvider } from '../../common';
import { TextReplacementContribution } from './text-replacement-contribution';
export declare class I18nPreloadContribution implements PreloadContribution {
    protected readonly localizationServer: LocalizationServer;
    protected readonly replacementContributions: ContributionProvider<TextReplacementContribution>;
    initialize(): Promise<void>;
    protected getReplacements(locale: string): Record<string, string>;
}
//# sourceMappingURL=i18n-preload-contribution.d.ts.map