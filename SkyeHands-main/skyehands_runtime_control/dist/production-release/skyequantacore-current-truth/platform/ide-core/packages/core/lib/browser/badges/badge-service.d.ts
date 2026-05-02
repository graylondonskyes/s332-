import { Emitter, Event } from '../../common';
import { Widget } from '../widgets';
export interface Badge {
    value: number;
    tooltip: string;
}
export declare class BadgeService {
    protected readonly badges: WeakMap<Widget, Badge>;
    protected readonly onDidChangeBadgesEmitter: Emitter<Widget>;
    get onDidChangeBadges(): Event<Widget>;
    getBadge(widget: Widget): Badge | undefined;
    showBadge(widget: Widget, badge?: Badge): void;
}
//# sourceMappingURL=badge-service.d.ts.map