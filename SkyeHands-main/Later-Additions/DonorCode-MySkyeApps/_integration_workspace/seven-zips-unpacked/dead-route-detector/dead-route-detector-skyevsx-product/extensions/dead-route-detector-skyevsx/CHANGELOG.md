# Changelog

## 0.6.0

- Added baseline report JSON import on both browser surfaces so regression compare can continue across sessions.
- Added current-report markdown and SARIF export on both browser surfaces.
- Added GitHub PR review comment markdown export.
- Added CLI review-comment output for CI and PR workflows.
- Hardened browser smoke to verify visible controls stay inside viewport margins and actually execute their claimed exports.

## 0.4.0

- Added real Chromium-rendered browser smoke and GitHub URL ingestion wrapper.
