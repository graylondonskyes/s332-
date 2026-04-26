# DIRECTIVE INCONSISTENCIES AND HONESTY NOTES

## 1) Route-pack contradiction
The directive currently contains both of these truths at the same time:
- Section 6.4 leaves route-pack work blank.
- Section 8 already claims route-pack export/import/duplicate warning are complete.

That is not clean. The recommended fix is:
- keep the already-landed base route-pack items checked where real
- create a separate remaining item for full route-pack completeness including notes, docs, proof, economics, and restore coverage

## 2) Global release-gate items are still blank
Section 11 is not a feature set. It is a global proof gate. Those boxes should not be treated like feature blanks that need UI first. They need a release harness first.

## 3) Keep offline MVP separate from hybrid temptation
Several later blanks are optional hybrid adapters. They should not be allowed to reshuffle the offline storage contract or block local use.

## 4) Honest next-code rule
The next approved code pass should not jump forward again. It should start at the earliest unresolved items in this order:
1. outcome source-of-truth
2. quick-action storage/write-through
3. location provenance
4. verification harness
5. signed service summary/delivery confirmation
6. then the remaining roadmap blanks in order
