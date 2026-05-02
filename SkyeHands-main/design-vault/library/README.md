# SkyeHands Design Library

This is the organized layer on top of `design-vault/sources`.

Use it before digging through raw cloned repositories.

## Start Here

- `AUDIT.md` - source-by-source audit, use cases, and import policy.
- `use-case-matrix.json` - machine-readable mapping from product type to sources, patterns, and quality bars.
- `templates/template-catalog.json` - reusable template lanes for SkyeHands/SkyDexia project generation.
- `recipes/import-recipes.md` - how to safely adapt UI and 3D patterns into target apps.
- `catalog/source-index.json` - generated searchable source index.
- `catalog/SOURCE_INDEX.md` - generated human-readable source index.
- `catalog/pattern-index.json` - generated searchable pattern/component/example index.
- `catalog/PATTERN_INDEX.md` - generated human-readable pattern summary.

## Refresh

Run this after adding or updating cloned sources:

```bash
node design-vault/scripts/refresh-design-library.mjs
```

## Agent Rule

For UI work, agents should check:

1. `use-case-matrix.json`
2. `templates/template-catalog.json`
3. `catalog/pattern-index.json`
4. `catalog/source-index.json`
5. raw files under `sources/`

Then implement in the target app with browser verification.
