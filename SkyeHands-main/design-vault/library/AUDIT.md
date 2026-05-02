# SkyeHands Design Vault Audit

This audit organizes the imported open-source UI and 3D references into a usable local library for SkyeHands and SkyDexia.

## Source Inventory

| Source | Local Path | License | Primary Use |
| --- | --- | --- | --- |
| React Three Fiber | `design-vault/sources/react-three-fiber` | MIT | React renderer architecture for Three.js scenes, canvas/event patterns, model loading, performance guidance. |
| Drei | `design-vault/sources/drei` | MIT | R3F helpers for controls, staging, lighting, loaders, materials, text, portals, scroll, presentation, and performance. |
| Triplex | `design-vault/sources/triplex` | Check repo before shipping | Visual R3F authoring, editor UX references, scene examples, VS Code/electron/cloud app patterns. |
| shadcn/ui | `design-vault/sources/shadcn-ui` | MIT | Accessible app components, templates, blocks, forms, charts, command menus, layout examples. |
| TailGrids | `design-vault/sources/tailgrids` | MIT | Tailwind component registry, docs, core components, icons, app and marketing UI sections. |

## High-Value Findings

- The vault is strongest for **React + Tailwind + R3F** projects.
- shadcn/ui and TailGrids overlap on primitives; use shadcn for app architecture and TailGrids for additional variants, docs, icons, and section ideas.
- React Three Fiber and Drei should be treated as implementation sources, not just inspiration.
- Triplex is valuable for visual 3D authoring and 3D editor ergonomics, especially for SkyDexia’s future IDE-like surfaces.
- The library should prefer **copy/adapt with license awareness** over blindly adding giant dependencies.

## Use-Case Map

| Use Case | Primary Sources | Notes |
| --- | --- | --- |
| SaaS dashboard | shadcn/ui, TailGrids | Use cards sparingly, real tables/forms/charts, command menus, sidebars, filters, and dense hierarchy. |
| Admin/control center | shadcn/ui, TailGrids | Prioritize navigation, status, logs, audit, permissions, and destructive-action clarity. |
| Landing page | TailGrids, shadcn/ui | Use sections, pricing, testimonials, feature grids, but avoid generic hero filler. |
| 3D product showcase | R3F, Drei, Triplex | Use Canvas, Environment, Stage, PresentationControls, Bounds, ContactShadows, GLTF loading. |
| 3D hero scene | R3F, Drei | Use meaningful product/scene content, not empty visual noise. Browser-smoke canvas rendering. |
| Editor/IDE UI | shadcn/ui, Triplex, TailGrids | Use sidebars, command menu, resizable panes, tabs, inspector panels, file trees, status bars. |
| Data/productivity app | shadcn/ui, TailGrids | Use tables, forms, dialogs, toasts, date/time pickers, charts, pagination, filters. |
| Spatial/creative tool | R3F, Drei, Triplex | Use transform controls, gizmos, selection, keyboard controls, viewport overlays, object inspectors. |
| Commerce storefront | TailGrids, shadcn/ui, R3F optional | Product cards, cart/checkout, filters, reviews, optional 3D product viewer. |
| Fortune-500 style enterprise template | shadcn/ui, TailGrids, donor templates | Compose app shell, auth boundary, analytics, billing hooks, audit logs, admin settings, support workflows. |

## Import Policy

1. Inspect the target app stack first.
2. Use local app components before importing new patterns.
3. Search `design-vault/library/catalog/source-index.json` and `design-vault/library/use-case-matrix.json`.
4. Copy only the specific component/pattern needed.
5. Preserve license notices where required.
6. Record major imports in the target project README or implementation note.
7. Browser-smoke UI work before claiming completion.

## Search Keywords

Use these terms when searching the vault:

- `dashboard`, `sidebar`, `command`, `dialog`, `table`, `chart`, `form`, `combobox`, `calendar`, `resizable`, `sheet`
- `Canvas`, `useFrame`, `useThree`, `Environment`, `Stage`, `Bounds`, `PresentationControls`, `ScrollControls`, `Html`, `Text3D`
- `gltf`, `loader`, `shader`, `portal`, `performance`, `instancing`, `selection`, `transform controls`
- `template`, `vite`, `next`, `react-router`, `registry`, `blocks`, `examples`

