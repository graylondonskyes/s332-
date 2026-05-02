# Dead Route Detector Report

- Workspace: skye-quality-gate
- Generated: 2026-04-30T08:05:54.262Z
- Files scanned: 59
- Dead route references: 13
- Orphan routes: 8
- Dead command findings: 6
- Placeholder controls: 2

## Dead route references

- /about.html · examples/healthy-static-site/index.html:6 · href
- /about.html · examples/healthy-static-site/scripts/app.js:3 · object-link
- /blog · examples/healthy-static-site/index.html:8 · href
- /blog · examples/healthy-static-site/scripts/app.js:5 · object-link
- /contact.html · examples/healthy-static-site/index.html:7 · href
- /contact.html · examples/healthy-static-site/scripts/app.js:4 · object-link
- /ghost · examples/broken-ui/src/App.tsx:21 · href
- /ghost · examples/broken-ui/src/menu.ts:4 · object-link
- /index.html · examples/healthy-static-site/about.html:2 · href
- /index.html · examples/healthy-static-site/blog/index.html:2 · href
- /index.html · examples/healthy-static-site/contact.html:2 · href
- /missing-report · examples/broken-ui/src/App.tsx:24 · navigation-helper
- /nope · examples/broken-ui/src/App.tsx:28 · navigation-helper

## Orphan routes

- /examples/healthy-static-site · examples/healthy-static-site/index.html:1
- /examples/healthy-static-site/about.html · examples/healthy-static-site/about.html:1
- /examples/healthy-static-site/blog · examples/healthy-static-site/blog/index.html:1
- /examples/healthy-static-site/blog/index.html · examples/healthy-static-site/blog/index.html:1
- /examples/healthy-static-site/contact.html · examples/healthy-static-site/contact.html:1
- /examples/healthy-static-site/index.html · examples/healthy-static-site/index.html:1
- /github/dead-route-detector-skyevsx · github/dead-route-detector-skyevsx/index.html:1
- /webapp/dead-route-detector-skyevsx · webapp/dead-route-detector-skyevsx/index.html:1

## Placeholder controls

- # · examples/broken-ui/src/App.tsx:22 · href-placeholder
- # · examples/broken-ui/src/menu.ts:5 · object-placeholder

## Dead executed commands

- brokenUi.onlyExecuted · examples/broken-ui/src/App.tsx:46 · executed
- matrix.executeGhost · examples/command-matrix/src/commands.ts:6 · executed

## Unregistered contributed commands

- brokenUi.runGhostThing · examples/broken-ui/package.json:1 · contributed
- matrix.runGhost · examples/command-matrix/package.json:1 · contributed

## Dead menu commands

- matrix.menuGhost · examples/command-matrix/package.json:1 · menu-reference

## Dead keybinding commands

- matrix.keyGhost · examples/command-matrix/package.json:1 · keybinding-reference
