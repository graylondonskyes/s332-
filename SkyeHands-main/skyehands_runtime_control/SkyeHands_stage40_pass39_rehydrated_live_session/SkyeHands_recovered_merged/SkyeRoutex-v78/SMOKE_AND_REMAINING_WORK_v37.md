# V37 Smoke and Remaining Work

## Smoke run performed

### Parse-check smoke passed
- `SkyeRoutex/tutorials.v35.js`
- `AE-FLOW/AE-Flow/tutorials.v35.js`
- `SkyeRoutex/index.check.js`
- `AE-FLOW/AE-Flow/index.check.js`

These passed with `node --check` in the current environment.

### Browser smoke attempt
A real headless Chromium browser pass was attempted again against both:
- local `http://127.0.0.1/...`
- local `file:///...`

The environment still returned `ERR_BLOCKED_BY_ADMINISTRATOR` for both targets, so I cannot honestly claim a successful unrestricted browser click-smoke from this sandbox.

The capture is stored in `browser_block_capture_v37.json`.

## What this pass added
- Routex Academy center
- AE FLOW Academy center
- role-based onboarding packs in both apps
- micro walkthrough library in both apps
- page-aware guide launchers in both apps
- learning analytics and heatmap in both apps
- inline modal explainers with direct guide launchers in both apps

## Remaining honest gaps
These are the items I still cannot truthfully mark as fully proven from this environment:
- unrestricted full browser click-smoke
- true second-device transfer proof on separate hardware
- true hardware microphone proof for the MediaRecorder lane

## Remaining upgrade backlog after v37
The main product-education backlog is now heavily reduced.

What still remains as optional premium-upgrade backlog rather than missing core product education:
- exportable learning-completion reports per user/device
- searchable in-app help index across all guides and explainers
- guided troubleshooting recipes for specific failure states
- role-pack completion certificates / readiness badges
- deeper live analytics if the product later adopts a persistent store instead of local-only progress state
