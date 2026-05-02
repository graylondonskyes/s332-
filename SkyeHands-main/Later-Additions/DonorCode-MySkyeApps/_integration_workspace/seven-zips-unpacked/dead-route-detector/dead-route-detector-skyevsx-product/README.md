# Dead Route Detector - SkyeVSX

Dead Route Detector - SkyeVSX is a packaged detector utility with three shipped surfaces plus a real CLI lane.

- `extensions/dead-route-detector-skyevsx/` — the VSX extension source
- `webapp/dead-route-detector-skyevsx/` — the browser scan and regression surface
- `github/dead-route-detector-skyevsx/` — the GitHub wrapper with repository and pull-request URL ingestion plus regression compare
- `shared/` — scanner core, report tools, and synced proof assets
- `scripts/` — packaging, proof-asset sync, Chromium browser smoke, CLI smoke, extension harness smoke, and product smoke
- `examples/` — the proof fixture plus additional truth-corpus fixtures
- `PROJECT_DOCS/` — directive, smoke outputs, valuation update, runtime audit, and browser screenshots
- `dist/` — generated artifacts after packaging

## What the product does

It scans a workspace for UI controls and paths that look live but do not actually resolve.

It detects:

- dead route references from links, buttons, menus, redirects, and route helper wrappers
- orphan routes that are declared but never referenced internally
- contributed commands that are never registered
- executed commands that are never contributed or registered
- dead menu and keybinding commands
- placeholder controls such as `href="#"` and `javascript:void(0)`

## Current product surfaces

From the extension surface:

- `Dead Route Detector: Scan Workspace`
- `Dead Route Detector: Open Report`
- `Dead Route Detector: Export Report JSON`
- `Dead Route Detector: Refresh Sidebar`
- `Dead Route Detector: Open Finding`

From the browser scan surface:

- run the included proof fixture entirely in-browser
- scan a selected workspace folder entirely in-browser
- load the bundled sample report
- pin the current report as a baseline or import a baseline report JSON
- compare the current report against the pinned or imported baseline
- export the current report as JSON, markdown, and SARIF
- export diff JSON and diff markdown

From the GitHub wrapper surface:

- scan a public GitHub repository by URL through the GitHub contents API
- scan a GitHub pull request by URL through the GitHub pull-request files API
- pin the current GitHub result as a baseline or import a baseline report JSON
- compare the current GitHub result against the pinned or imported baseline
- export the current report as JSON, markdown, and SARIF
- export diff JSON, diff markdown, and PR review comment markdown

From the CLI surface:

- scan a folder or zip archive
- emit JSON, markdown, SARIF, and summary output
- compare two reports and emit regression diff JSON and markdown
- render a pull-request review comment markdown from two reports
- return deterministic CI-style exit codes

## Packaging

Run from the product root:

```bash
node scripts/package-all.mjs
```

That produces:

- `dist/dead-route-detector-skyevsx-0.6.0.vsix`
- `dist/dead-route-detector-skyevsx-extension-source.zip`
- `dist/dead-route-detector-skyevsx-webapp.zip`
- `dist/dead-route-detector-skyevsx-github-wrapper.zip`
- `dist/dead-route-detector-skyevsx-product-full.zip`

## Smoke proof status

Run from the product root:

```bash
node scripts/smoke.mjs
```

The current smoke lane proves these things now:

- the intentionally broken proof fixture still produces the expected findings
- the healthy static-site and next-style fixtures stay clean on route checks
- the command-matrix fixture surfaces the expected command failures
- the product's own extension, webapp, and GitHub wrapper do not self-flag as dead on the current scanner rules
- Chromium renders the browser scan surface, verifies visible controls inside viewport margins, uploads real directories, pins or imports a baseline, compares a regression run, exports the report as JSON, markdown, and SARIF, exports diff JSON and diff markdown, and stores screenshots
- Chromium renders the GitHub wrapper, verifies visible controls inside viewport margins, scans a repository URL, pins or imports a baseline, scans a pull-request URL, compares the regression diff, exports the report as JSON, markdown, and SARIF, exports diff JSON and diff markdown, exports a PR review comment markdown, and stores screenshots
- the CLI scans a folder, scans a zip archive, emits JSON, markdown, and SARIF, compares two reports, renders a PR review comment markdown, and returns deterministic exit codes for scan, compare, and review-comment lanes
- the extension command behavior is still covered by a stubbed `vscode` host harness for regression
- local linked files and loaded assets exist
- packaged artifacts exist and include the directive, smoke report, screenshots, and CLI scripts

The current smoke lane does **not** yet prove these things:

- live VS Code or OpenVSX runtime UI proof
- platform-wide investor-grade proof across every shipped surface

## CLI examples

```bash
node scripts/cli.mjs scan examples/healthy-static-site --json out/report.json --markdown out/report.md --sarif out/report.sarif --summary
node scripts/cli.mjs scan some-workspace.zip --json out/zip-report.json
node scripts/cli.mjs compare --baseline out/base.json --candidate out/candidate.json --json out/diff.json --markdown out/diff.md
node scripts/cli.mjs review-comment --baseline out/base.json --candidate out/candidate.json --markdown out/review.md --owner acme --repo route-lab --pull 17
```

## Proof-asset sync

To regenerate the proof fixture JSON, bundled sample report, bundled report tools, and browser scanner copies:

```bash
node scripts/sync-browser-assets.mjs
```
