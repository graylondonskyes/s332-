import { Range } from 'vscode-languageserver-protocol';
import { CancellationToken } from './cancellation';
import URI from './uri';
/** Represents a textual diff. */
export interface Diff {
    readonly changes: readonly DetailedLineRangeMapping[];
}
export interface DetailedLineRangeMapping extends LineRangeMapping {
    readonly innerChanges?: readonly RangeMapping[];
}
export interface LineRangeMapping {
    readonly left: LineRange;
    readonly right: LineRange;
}
/** Represents a range of whole lines of text. */
export interface LineRange {
    /** A zero-based number of the start line. */
    readonly start: number;
    /** A zero-based number of the end line, exclusive. */
    readonly end: number;
}
export interface RangeMapping {
    readonly left: Range;
    readonly right: Range;
}
export declare const DiffComputer: unique symbol;
export interface DiffComputer {
    computeDiff(left: URI, right: URI, options?: DiffComputerOptions): Promise<Diff | undefined>;
}
export interface DiffComputerOptions {
    readonly cancellationToken?: CancellationToken;
}
//# sourceMappingURL=diff.d.ts.map