# SkyeMail Status

- Classification: `partial`
- Runnable surface: root standalone mail pages, `suite/` shell, and the local `build:suite` dist sync lane.
- Proof command: `npm run smoke:standalone-proof`
- What the proof covers: root page presence, suite app mounts, key Netlify Function source lanes, and successful `dist/SkyeMail` regeneration.
- What it does not cover: live provider credentials, deployed Functions execution, Gmail OAuth, inbound webhooks, or mail delivery.
