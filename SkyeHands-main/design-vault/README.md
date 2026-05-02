# SkyeHands Design Vault

This folder is the repo-local design and 3D interface knowledge base for SkyeHands.

The vault has two jobs:

1. Keep open-source UI and Three.js/R3F reference repos available locally.
2. Give SkyeHands and SkyDexia agents concrete design patterns to inspect before building user-facing interfaces.

## Source Layout

Clone third-party design systems and 3D references into `sources/`.

Recommended starter set:

```bash
cd SkyeHands-main/design-vault/sources
git clone https://github.com/pmndrs/react-three-fiber
git clone https://github.com/pmndrs/drei
git clone https://github.com/pmndrs/triplex
git clone https://github.com/shadcn-ui/ui shadcn-ui
git clone https://github.com/Tailgrids/tailgrids
```

Optional follow-up sources:

- Magic UI registry/components for animated landing-page effects.
- Origin UI/ReUI shadcn-style component registries for app screens and dashboards.
- Three.js examples for raw WebGL, shaders, loaders, controls, and post-processing.
- Theatre.js examples for timeline-based animation.

## Library Layer

The searchable library sits above the raw cloned repos:

- `library/AUDIT.md` explains what each imported source is good for.
- `library/use-case-matrix.json` maps product/UI use cases to sources and quality bars.
- `library/templates/template-catalog.json` defines reusable SkyeHands template lanes.
- `library/recipes/import-recipes.md` explains how to import/adapt patterns safely.
- `library/catalog/source-index.json` is generated from the current `sources/` folder.
- `library/catalog/SOURCE_INDEX.md` is the human-readable generated source summary.

Refresh the generated catalog after adding or updating sources:

```bash
node design-vault/scripts/refresh-design-library.mjs
```

## How Agents Should Use This

Before creating or redesigning a frontend, agents should:

1. Identify the UI type: SaaS dashboard, landing page, editor, marketplace, internal ops tool, portfolio, 3D scene, or hybrid.
2. Read `design-vault/library/use-case-matrix.json` for the matching use case.
3. Search `design-vault/library/catalog/source-index.json` and `design-vault/sources` for comparable layouts, interactions, components, and 3D scene patterns.
4. Build with the current project stack first. Do not force React, Tailwind, or R3F into a project that does not use them unless the task calls for it.
5. Prefer owned copy-paste components and local patterns over permanent dependency sprawl.
6. Verify the result in a real browser when the repo has UI behavior.

## Design Quality Bar

User-facing SkyeHands interfaces should avoid default, unfinished AI UI.

Required traits:

- Clear first screen with the actual product or workflow visible.
- Strong spacing, alignment, hierarchy, contrast, and responsive behavior.
- Domain-appropriate styling: dense and calm for tools, expressive for marketing or games.
- No vague decorative filler that does not support the user task.
- No giant generic gradient hero when the user asked for a usable app.
- 3D scenes must be meaningful, framed correctly, performant, and nonblank in browser smoke.

## License Rule

Keep third-party code in `sources/` unless intentionally imported into a project. When importing code:

- Check the source license.
- Preserve required notices.
- Prefer MIT/Apache/BSD sources for commercial SkyeHands work.
- Record notable imports in the target app's README or implementation notes.
