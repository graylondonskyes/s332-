# DEAD ROUTE DETECTOR VALUATION UPDATE

Current valuation: **four hundred twenty-five thousand dollars ($425,000 USD)**.

## Why the number moved up on this pass

- The browser scan surface is no longer limited to same-session compare. It now supports imported baseline JSON plus JSON, markdown, and SARIF proof exports, and those actions are rendered-runtime smoked.
- The GitHub wrapper now produces a PR-ready review comment markdown in addition to report and diff exports, which makes it more credible as a repository and pull-request review utility rather than only a scan viewer.
- The CLI now mirrors that workflow with a real review-comment command, making the product more usable in CI and release-review lanes.
- The smoke bar is higher on this pass. The browser proof now verifies visible controls inside viewport bounds and verifies that the claimed export artifacts are actually produced and contain the expected payloads.

## Why the number is not higher yet

- The live VS Code or OpenVSX runtime lane is still not closed.
- Full platform-wide investor-grade runtime proof across every shipped surface is still not earned.
