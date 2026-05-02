# SkyeHands Agent Instructions

## Browser Smoke Is Required When UI Changes

This repo has a repo-local Playwright browser stack. Do not claim browser smoke cannot run because Chromium is missing until you have checked the shared SkyeHands browser-smoke environment.

Canonical verifier:

```bash
node tools/browser-smoke/verify-browser-smoke-env.mjs
```

Canonical browser cache:

```bash
.ms-playwright
```

Required environment for any Playwright browser smoke:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.ms-playwright"
```

Reusable wrapper:

```bash
tools/browser-smoke/with-repo-chromium.sh <your smoke command...>
```

Example:

```bash
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-standalone.mjs http://127.0.0.1:4177/index.html
```

Installed repo-local browser files include Chromium, Chromium headless shell, and FFmpeg under `.ms-playwright`. If any of those are missing, repair with the command printed by `verify-browser-smoke-env.mjs`.

## No-Theater Verification Rule

For frontend work, real browser smoke is the default verification target. Static syntax checks are useful but do not replace browser smoke when the app has UI/runtime behavior.

## Design Vault Required For UI Work

When creating or redesigning websites, app screens, dashboards, editors, 3D experiences, or product UI, consult the repo-local design guidance before implementation:

- `design-vault/README.md`
- `design-vault/library/README.md`
- `design-vault/library/use-case-matrix.json`
- `design-vault/library/templates/template-catalog.json`
- `design-vault/library/catalog/pattern-index.json`
- `design-vault/library/catalog/source-index.json`
- `design-vault/recipes/frontend-design-agent-contract.md`
- `SkyDexia-Additional-Knowledge/design-agent/SKYDEXIA_DESIGN_AGENT.md`

Use `design-vault/sources` as the local reference area for open-source UI and Three.js/R3F repos. Favor existing project conventions first, then use the design vault for better layout, interaction, motion, component, and 3D scene patterns.

## SkyDexia Knowledge Must Stay Current

SkyDexia has her own knowledge and AI-brain surfaces. When changes affect SkyeHands architecture, autonomous project generation, AE brains, donor templates, provider routing, IDE behavior, or UI/design capability, update the SkyDexia knowledge files in the same change set.

Canonical wiring:

- `SkyDexia-Additional-Knowledge/SKYDEXIA_ULTIMATE_KNOWLEDGE_ORCHESTRATOR.md`
- `SkyDexia-Additional-Knowledge/manifests/skydexia-knowledge-wiring.json`
- `SkyDexia-Additional-Knowledge/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated-static-smoke/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated/configs/skydexia/knowledge-links.json`
- `AbovetheSkye-Platforms/SkyDexia/knowledge-base/KNOWLEDGE_SKELETON_INDEX.json`
- `AbovetheSkye-Platforms/SkyDexia/orchestration/ae-brain-orchestrator.json`
- `AbovetheSkye-Platforms/SkyeWebCreatorMax/SkyeWebCreatorMax_DIRECTIVE.md`
- `AbovetheSkye-Platforms/SkyeWebCreatorMax/config/env.contract.json`
- `skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs`

Proof command:

```bash
cd SkyeSol/skyesol-main && npm run skydexia:wiring-smoke
```
