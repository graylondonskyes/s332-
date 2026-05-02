import { interfaces } from 'inversify';
import { WidgetDecoration } from '../widget-decoration';
import { Title, Widget } from '../widgets';
import { TabBarDecorator } from '../shell/tab-bar-decorator';
import { Disposable, Event } from '../../common';
import { BadgeService } from './badge-service';
export declare class TabBarBadgeDecorator implements TabBarDecorator {
    readonly id = "theia-plugin-view-container-badge-decorator";
    protected readonly badgeService: BadgeService;
    onDidChangeDecorations(...[cb, thisArg, disposable]: Parameters<Event<void>>): Disposable;
    decorate({ owner }: Title<Widget>): WidgetDecoration.Data[];
}
export declare function bindBadgeDecoration(bind: interfaces.Bind): void;
//# sourceMappingURL=tabbar-badge-decorator.d.ts.map