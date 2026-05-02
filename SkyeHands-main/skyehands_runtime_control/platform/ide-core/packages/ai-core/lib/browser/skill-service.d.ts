import { DisposableCollection, Event, ILogger, URI } from '@theia/core';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { AICorePreferences } from '../common/ai-core-preferences';
import { Skill } from '../common/skill';
export declare const SkillService: unique symbol;
export interface SkillService {
    /** Get all discovered skills */
    getSkills(): Skill[];
    /** Get a skill by name */
    getSkill(name: string): Skill | undefined;
    /** Event fired when skills change */
    readonly onSkillsChanged: Event<void>;
}
export declare class DefaultSkillService implements SkillService {
    protected readonly preferences: AICorePreferences;
    protected readonly fileService: FileService;
    protected readonly logger: ILogger;
    protected readonly envVariablesServer: EnvVariablesServer;
    protected readonly workspaceService: WorkspaceService;
    protected skills: Map<string, Skill>;
    protected toDispose: any;
    protected watchedDirectories: Set<string>;
    protected parentWatchers: Map<string, string>;
    protected readonly onSkillsChangedEmitter: any;
    readonly onSkillsChanged: Event<void>;
    protected lastSkillDirectoriesValue: string | undefined;
    protected updateDebounceTimeout: ReturnType<typeof setTimeout> | undefined;
    protected init(): void;
    getSkills(): Skill[];
    getSkill(name: string): Skill | undefined;
    protected scheduleUpdate(): void;
    protected update(): Promise<void>;
    protected getWorkspaceSkillsDirectoryPath(): string | undefined;
    protected getDefaultSkillsDirectoryPath(): Promise<string>;
    protected processSkillDirectoryWithParentWatching(directoryPath: string, skills: Map<string, Skill>, disposables: DisposableCollection, watchedDirectories: Set<string>, parentWatchers: Map<string, string>): Promise<void>;
    protected processConfiguredSkillDirectory(directoryPath: string, skills: Map<string, Skill>, disposables: DisposableCollection, watchedDirectories: Set<string>): Promise<void>;
    protected processExistingSkillDirectory(dirURI: URI, skills: Map<string, Skill>, disposables: DisposableCollection, watchedDirectories: Set<string>): Promise<void>;
    protected loadSkillFromDirectory(directoryUri: URI, directoryName: string, skills: Map<string, Skill>): Promise<void>;
    protected setupDirectoryWatcher(dirURI: URI, disposables: DisposableCollection, watchedDirectories: Set<string>): void;
}
//# sourceMappingURL=skill-service.d.ts.map