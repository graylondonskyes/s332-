# Dead Route Detector - SkyeVSX GitHub Wrapper

This package is the GitHub-facing wrapper surface for Dead Route Detector - SkyeVSX.

What it does now:

- scan a public GitHub repository by URL through the GitHub contents API
- scan a GitHub pull request by URL through the GitHub pull-request files API
- pin the current GitHub result as a baseline
- compare the current GitHub result against the pinned baseline
- load the bundled sample report
- run the bundled proof fixture through the shared scanner core
- export the current report JSON
- export diff JSON and diff markdown

What is not yet proven here:

- live public GitHub network proof in this packaging environment
- inline PR annotation or comment posting
- live editor-host proof for the extension surface
