# Design Vault Import Recipes

These recipes describe how SkyeHands agents should turn design-vault references into project code.

## React + Tailwind App UI

Use for dashboards, admin panels, SaaS apps, client portals, CRM-style tools, and workflow products.

1. Inspect target app package, styling, and component folders.
2. Search shadcn/ui examples and TailGrids registry for matching controls.
3. Copy the smallest useful component or layout pattern.
4. Adapt imports to local aliases and component conventions.
5. Replace demo data with real app state or typed fixtures.
6. Add states: loading, empty, error, disabled, active, success.
7. Run app build/check and browser smoke.

Useful vault paths:

- `sources/shadcn-ui/apps/v4/examples/base`
- `sources/shadcn-ui/apps/v4/components`
- `sources/shadcn-ui/templates`
- `sources/tailgrids/apps/docs/src/registry/core`
- `sources/tailgrids/apps/docs/content/components`

## R3F Product Showcase

Use for 3D product pages, 3D landing heroes, configurators, device previews, and scene-based sales pages.

1. Confirm React is available or intentionally add React/R3F.
2. Install project dependencies only in the target app, not in `design-vault`.
3. Start with R3F Canvas and Drei helpers.
4. Use `Bounds`, `Stage`, `Environment`, `PresentationControls`, `ContactShadows`, and `Html` overlays where appropriate.
5. Keep scene content meaningful: product, artifact, model, data, workflow, or brand object.
6. Verify canvas pixels render and scene is framed on desktop and mobile.

Useful vault paths:

- `sources/react-three-fiber/docs/getting-started`
- `sources/react-three-fiber/example/src/demos`
- `sources/drei/docs/staging`
- `sources/drei/docs/controls`
- `sources/drei/docs/loaders`
- `sources/drei/src/core`

## 3D Editor / Spatial Tool

Use for creative tools, object inspectors, spatial builders, model viewers, scene editors, and SkyDexia/SkyeHands IDE extensions.

1. Use Triplex examples for authoring/editor UX reference.
2. Use Drei controls for viewport manipulation.
3. Use shadcn/TailGrids for sidebars, inspectors, command menus, and property panels.
4. Keep canvas full-bleed or workflow-centered, with overlays that do not block critical scene content.
5. Verify interactions: select, drag/orbit, update panel, resize viewport.

Useful vault paths:

- `sources/triplex/examples`
- `sources/triplex/apps/vscode`
- `sources/triplex/apps/electron`
- `sources/drei/docs/gizmos`
- `sources/drei/docs/controls`
- `sources/shadcn-ui/apps/v4/examples/base/resizable*`

## Enterprise Template / Fortune-500 Platform Reference

Use for SaaS templates that need to feel complete: auth, billing, admin, audit, analytics, support, user settings, and operational proof.

1. Start with the target domain and core workflow.
2. Compose app shell from shadcn/TailGrids.
3. Pull donor-code patterns only with provenance and compatibility notes.
4. Include admin, billing, audit, settings, and support surfaces when the product implies enterprise readiness.
5. Wire SkyGate/SkyeHands auth and provider patterns when applicable.
6. Run smoke checks and update SkyDexia knowledge if new reusable patterns are created.

Useful vault paths:

- `sources/shadcn-ui/templates`
- `sources/shadcn-ui/apps/v4/examples/base`
- `sources/tailgrids/apps/docs/src/registry/core`
- `AbovetheSkye-Platforms/SkyDexia/donors`
- `AbovetheSkye-Platforms/SkyDexia/generated-projects`

