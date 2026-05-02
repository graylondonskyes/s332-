# Frontend Design Agent Contract

Use this contract whenever an agent creates or improves a website, application UI, 3D page, product surface, or design system inside SkyeHands.

## First Pass

The agent must answer these questions before implementing:

- What is the user trying to do on the first screen?
- Is this an app, dashboard, editor, commerce flow, marketing site, game, or 3D experience?
- Which existing local app patterns should be preserved?
- Which design-vault sources are relevant?
- What browser smoke path will prove the result works?

## Reference Lookup

Use `design-vault/sources` as a local inspiration and implementation library.

Preferred lookup targets:

- `shadcn-ui` for accessible component architecture and app primitives.
- `tailgrids` for Tailwind/React sections, landing blocks, and UI blocks.
- `react-three-fiber` for declarative Three.js scene architecture.
- `drei` for practical 3D helpers, controls, materials, text, scroll, and loaders.
- `triplex` for visual React Three Fiber workflows and authoring examples.

## Build Rules

- Match the target app's framework and styling conventions.
- Use real controls for real workflows: menus, tabs, sliders, toggles, segmented controls, dialogs, tables, command menus, upload zones, editors, timelines, and inspectors where appropriate.
- Use Three.js/R3F for 3D scenes, product showcases, immersive hero scenes, configurators, spatial editors, and interactive visualizations.
- Do not use 3D as decoration when a clear 2D workflow is better.
- Prefer icons for compact actions and text labels for meaningful commands.
- Keep repeated content as real components, not hand-copied markup.

## Anti-Trash UI Checklist

Reject or revise designs that have:

- Generic centered hero plus three cards when the task is an app.
- Huge typography inside cramped panels.
- Low-contrast text, mystery buttons, broken mobile layout, or overlapping elements.
- Placeholder gradients, empty cards, fake charts, or ornamental blobs.
- Unverified canvas rendering for 3D work.
- A first viewport that hides the actual product/workflow.

## Verification

For frontend changes, run the repo's browser smoke path when possible.

At SkyeHands root, first check:

```bash
node tools/browser-smoke/verify-browser-smoke-env.mjs
```

Then run the relevant app preview/dev server and smoke it with repo-local Chromium.

