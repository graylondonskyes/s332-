import { BrowserWindow, WebContents, Event as ElectronEvent } from '../../electron-shared/electron';
import { ForkOptions } from 'child_process';
import { ElectronFrontendApplicationConfig, FrontendApplicationConfig } from '@theia/application-package/lib/application-props';
import URI from '../common/uri';
import { Deferred } from '../common/promise-util';
import { MaybePromise } from '../common/types';
import { ContributionProvider } from '../common/contribution-provider';
import { ElectronSecurityTokenService } from './electron-security-token-service';
import { ElectronSecurityToken } from '../electron-common/electron-token';
import { WindowSearchParams } from '../common/window';
import { TheiaBrowserWindowOptions, TheiaElectronWindow, TheiaElectronWindowFactory } from './theia-electron-window';
import { ElectronMainApplicationGlobals } from './electron-main-constants';
import { ThemeMode } from '../common/theme';
export { ElectronMainApplicationGlobals };
/**
 * Options passed to the main/default command handler.
 */
export interface ElectronMainCommandOptions {
    /**
     * By default, the first positional argument. Should be either a relative or absolute file-system path pointing to a file or a folder.
     */
    readonly file?: string;
    readonly cwd: string;
    /**
     * If the app is launched for the first time, `secondInstance` is false.
     * If the app is already running but user relaunches it, `secondInstance` is true.
     */
    readonly secondInstance: boolean;
}
/**
 * The default entrypoint will handle a very rudimentary CLI to open workspaces by doing `app path/to/workspace`. To override this behavior, you can extend and rebind the
 * `ElectronMainApplication` class and overriding the `launch` method.
 * A JSON-RPC communication between the Electron Main Process and the Renderer Processes is available: You can bind services using the `ElectronConnectionHandler` and
 * `ElectronIpcConnectionProvider` APIs, example:
 *
 * From an `electron-main` module:
 *
 *     bind(ElectronConnectionHandler).toDynamicValue(context =>
 *          new RpcConnectionHandler(electronMainWindowServicePath,
 *          () => context.container.get(ElectronMainWindowService))
 *     ).inSingletonScope();
 *
 * And from the `electron-browser` module:
 *
 *     bind(ElectronMainWindowService).toDynamicValue(context =>
 *          ElectronIpcConnectionProvider.createProxy(context.container, electronMainWindowServicePath)
 *     ).inSingletonScope();
 */
export declare const ElectronMainApplicationContribution: unique symbol;
export interface ElectronMainApplicationContribution {
    /**
     * The application is ready and is starting. This is the time to initialize
     * services global to this process.
     *
     * Invoked when the electron-main process starts for the first time.
     */
    onStart?(application: ElectronMainApplication): MaybePromise<void>;
    /**
     * The application is stopping. Contributions must perform only synchronous operations.
     */
    onStop?(application: ElectronMainApplication): void;
}
export declare class ElectronMainProcessArgv {
    protected get processArgvBinIndex(): number;
    get isBundledElectronApp(): boolean;
    get isElectronApp(): boolean;
    getProcessArgvWithoutBin(argv?: any): Array<string>;
    getProcessArgvBin(argv?: any): string;
}
export declare namespace ElectronMainProcessArgv {
    interface ElectronMainProcess extends NodeJS.Process {
        readonly defaultApp: boolean;
        readonly versions: NodeJS.ProcessVersions & {
            readonly electron: string;
        };
    }
}
export declare class ElectronMainApplication {
    protected readonly contributions: ContributionProvider<ElectronMainApplicationContribution>;
    protected readonly globals: ElectronMainApplicationGlobals;
    protected processArgv: ElectronMainProcessArgv;
    protected electronSecurityTokenService: ElectronSecurityTokenService;
    protected readonly electronSecurityToken: ElectronSecurityToken;
    protected readonly windowFactory: TheiaElectronWindowFactory;
    protected isPortable: boolean;
    protected readonly electronStore: any;
    protected readonly _backendPort: Deferred<number>;
    readonly backendPort: Promise<number>;
    protected _config: FrontendApplicationConfig | undefined;
    protected useNativeWindowFrame: boolean;
    protected customBackgroundColor?: string;
    protected didUseNativeWindowFrameOnStart: Map<number, boolean>;
    protected windows: Map<number, TheiaElectronWindow>;
    protected activeWindowStack: number[];
    protected restarting: boolean;
    /** Used to temporarily store the reference to an early created main window */
    protected initialWindow?: BrowserWindow;
    get config(): FrontendApplicationConfig;
    protected makePortable(): boolean;
    start(config: FrontendApplicationConfig): Promise<void>;
    protected getTitleBarStyle(config: FrontendApplicationConfig): 'native' | 'custom';
    setTitleBarStyle(webContents: WebContents, style: string): void;
    setBackgroundColor(webContents: WebContents, backgroundColor: string): void;
    setTheme(theme: ThemeMode): void;
    protected saveState(webContents: Electron.WebContents): void;
    /**
     * @param id the id of the WebContents of the BrowserWindow in question
     * @returns 'native' or 'custom'
     */
    getTitleBarStyleAtStartup(webContents: WebContents): 'native' | 'custom';
    protected determineSplashScreenBounds(initialWindowBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    protected isShowWindowEarly(): boolean;
    protected showInitialWindow(urlToOpen: string | undefined): void;
    protected configureAndShowSplashScreen(mainWindow: BrowserWindow): Promise<BrowserWindow>;
    protected isShowSplashScreen(): boolean;
    protected getSplashScreenOptions(): ElectronFrontendApplicationConfig.SplashScreenOptions | undefined;
    /**
     * Use this rather than creating `BrowserWindow` instances from scratch, since some security parameters need to be set, this method will do it.
     *
     * @param options
     */
    createWindow(asyncOptions?: MaybePromise<TheiaBrowserWindowOptions>): Promise<BrowserWindow>;
    getLastWindowOptions(): Promise<TheiaBrowserWindowOptions>;
    protected avoidOverlap(options: TheiaBrowserWindowOptions): TheiaBrowserWindowOptions;
    protected getDefaultOptions(): TheiaBrowserWindowOptions;
    closeWindowById(webContentsId: number): void;
    openDefaultWindow(params?: WindowSearchParams): Promise<BrowserWindow>;
    protected openWindowWithWorkspace(workspacePath: string): Promise<BrowserWindow>;
    protected reuseOrCreateWindow(asyncOptions: MaybePromise<TheiaBrowserWindowOptions>): Promise<BrowserWindow>;
    /**
     * "Gently" close all windows, application will not stop if a `beforeunload` handler returns `false`.
     */
    requestStop(): void;
    protected handleMainCommand(options: ElectronMainCommandOptions): Promise<void>;
    openUrl(url: string): Promise<void>;
    protected createWindowUri(params?: WindowSearchParams): Promise<URI>;
    protected getDefaultTheiaWindowOptions(): TheiaBrowserWindowOptions;
    protected getDefaultTheiaSecondaryWindowBounds(): TheiaBrowserWindowOptions;
    protected getDefaultTheiaWindowBounds(): TheiaBrowserWindowOptions;
    /**
     * Returns the display where a new window should be opened.
     * Attempts to use the display nearest to the cursor position for multi-monitor setups.
     * Falls back to the primary display if cursor position cannot be determined
     * (e.g., on Wayland before any window is opened).
     * See: https://github.com/eclipse-theia/theia/issues/16582
     */
    protected getDisplayForNewWindow(): Electron.Display;
    /**
     * Detects if the current session is running natively under Wayland
     * (i.e., not using X11 fallback/XWayland).
     */
    protected isWaylandSession(): boolean;
    /**
     * Save the window geometry state on every change.
     */
    protected attachSaveWindowState(electronWindow: BrowserWindow): void;
    protected saveWindowState(electronWindow: BrowserWindow): void;
    /**
     * Return a string unique to the current display layout.
     */
    protected getCurrentScreenLayout(): string;
    /**
     * Start the NodeJS backend server.
     *
     * @return Running server's port promise.
     */
    protected startBackend(): Promise<number>;
    protected getForkOptions(): Promise<ForkOptions>;
    protected attachElectronSecurityToken(port: number): Promise<void>;
    protected hookApplicationEvents(): void;
    protected onWillQuit(event: ElectronEvent): void;
    protected onSecondInstance(event: ElectronEvent, _: string[], cwd: string, originalArgv: string[]): Promise<void>;
    protected onWebContentsCreated(event: ElectronEvent, webContents: WebContents): void;
    protected onWindowAllClosed(event: ElectronEvent): void;
    restart(webContents: WebContents): Promise<void>;
    protected startContributions(): Promise<void>;
    protected stopContributions(): void;
}
//# sourceMappingURL=electron-main-application.d.ts.map