# DEAD ROUTE DETECTOR RUNTIME AUDIT

## What is now real

- The browser scan surface now carries a cross-session regression lane. It can export the current report as JSON, markdown, and SARIF; import a baseline report JSON from disk; compare the next run against that imported baseline; and export the regression diff as JSON and markdown.
- The GitHub wrapper now carries the same cross-session regression lane and adds a real PR review comment markdown export on top of repository and pull-request ingestion.
- The CLI now has a review-comment lane in addition to scan and compare. It can turn two report JSON files into a PR-ready markdown summary with deterministic exit codes.
- Rendered browser smoke now verifies visible controls remain inside viewport margins and that the controls do what they claim. The smoke executes file-input folder scan, baseline import, repository scan, pull-request scan, report export, SARIF export, markdown export, diff export, and review-comment export with real downloaded artifacts.

## What remains open

- The extension surface is still not proven inside a live VS Code or OpenVSX runtime. The current extension lane is still harness-covered rather than investor-grade editor-host proof.
- Because the live editor-host lane is still open, the product still does not have platform-wide investor-grade runtime proof across every shipped surface.

## Honest status

This pass materially strengthened the product without pretending the editor-host lane is closed. The browser surfaces now support cross-session baseline import, multi-format current-report export, and PR-ready review output with rendered-runtime smoke proving the claimed browser actions. The remaining serious proof gap is still the live VS Code or OpenVSX runtime lane.
