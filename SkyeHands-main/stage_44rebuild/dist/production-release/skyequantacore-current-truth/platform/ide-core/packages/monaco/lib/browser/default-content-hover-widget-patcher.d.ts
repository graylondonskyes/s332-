import { ApplicationShell, FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { SetActualHeightForContentHoverWidgetParams } from './content-hover-widget-patcher';
export declare class DefaultContentHoverWidgetPatcher implements FrontendApplicationContribution {
    onStart(app: FrontendApplication): void;
    protected updateContentHoverWidgetHeight(params: SetActualHeightForContentHoverWidgetParams): void;
    protected getTopPanelHeight(shell: ApplicationShell): number;
    protected getStatusBarHeight(shell: ApplicationShell): number;
}
//# sourceMappingURL=default-content-hover-widget-patcher.d.ts.map