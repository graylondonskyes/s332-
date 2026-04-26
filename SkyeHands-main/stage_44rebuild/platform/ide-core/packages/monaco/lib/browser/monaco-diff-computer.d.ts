import { Diff, DiffComputer } from '@theia/core/lib/common/diff';
import URI from '@theia/core/lib/common/uri';
export declare class MonacoDiffComputer implements DiffComputer {
    computeDiff(left: URI, right: URI): Promise<Diff | undefined>;
}
//# sourceMappingURL=monaco-diff-computer.d.ts.map