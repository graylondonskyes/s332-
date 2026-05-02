# Platform intake lane for SkyeHands

Drop every future user platform into this exact lane:

- `platform/user-platforms/<platform-slug>/source/`

Then register and verify it through SkyeHands:

- `npm run workspace:proof:section61`
- `node bin/platform-import.mjs --source ../../platform/user-platforms/<platform-slug>/source --slug <platform-slug> --name "<Display Name>"`
- `node bin/platform-launch-plan.mjs --slug <platform-slug>`

Generated files per platform:

- `platform/user-platforms/<platform-slug>/skyehands.platform.json`
- `platform/user-platforms/REGISTRY.json`

This lane is the permanent home for future imported platforms.
