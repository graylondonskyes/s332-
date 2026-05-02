# DEAD ROUTE DETECTOR IMPLEMENTATION DIRECTIVE

☑ Shared scanner core exists and is wired into the extension and both shipped browser surfaces.
☑ Shared report-tools layer exists and is wired into both shipped browser surfaces and the CLI.
☑ Browser scan surface implements selected-folder scan logic, proof-fixture load, and sample-report load.
☑ Browser scan surface implements baseline pin, baseline JSON import, and current-versus-baseline compare.
☑ Browser scan surface exports the current report as JSON, markdown, and SARIF.
☑ Browser scan surface exports the regression diff as JSON and markdown.
☑ GitHub wrapper surface implements repository URL scan and pull-request URL scan through deterministic GitHub API fixture coverage.
☑ GitHub wrapper surface implements baseline pin, baseline JSON import, and current-versus-baseline compare.
☑ GitHub wrapper surface exports the current report as JSON, markdown, and SARIF.
☑ GitHub wrapper surface exports the regression diff as JSON and markdown plus PR review comment markdown.
☑ CLI implements folder scan, zip scan, report JSON export, report markdown export, SARIF export, and summary output.
☑ CLI implements baseline-versus-candidate compare with diff JSON export, diff markdown export, and deterministic regression exit code.
☑ CLI implements PR review comment markdown generation from baseline and candidate report JSON inputs.
☑ Proof assets are synced from source and shipped into both browser surfaces.
☑ Shipped browser surfaces self-scan clean for dead-route and placeholder false positives on the current rules.
☑ Redirect-only alias pages are treated as alias routes instead of orphan-route false positives.
☑ Packaging regenerates the VSIX, extension source zip, webapp zip, wrapper zip, and full product zip.
☑ Real rendered browser smoke proves the browser scan surface controls are visible inside viewport margins and do the claimed scan, baseline, compare, and export actions end to end.
☑ Real rendered browser smoke proves the GitHub wrapper controls are visible inside viewport margins and do the claimed repository scan, pull-request scan, baseline, compare, and export actions end to end.
☑ Real CLI smoke proves scan, compare, review-comment, and deterministic exit codes end to end.
☑ Multi-fixture truth corpus proves low false positives and low false negatives across more than one app shape.
☑ Runtime smoke proves cross-session baseline import and multi-format proof exports on both shipped browser surfaces.
☑ Runtime smoke proves PR review comment generation on both the GitHub wrapper surface and the CLI surface.
☐ Live VS Code or OpenVSX runtime smoke proving visible extension UI, commands, report rendering, export, sidebar refresh, and open-finding behavior.
☐ Full platform-wide investor-grade runtime proof across every shipped surface.
