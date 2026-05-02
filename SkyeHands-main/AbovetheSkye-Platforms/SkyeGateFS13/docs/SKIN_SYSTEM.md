# SkyeGateFS13 Skin System

This is additive. The original SkyeGateFS13 look remains the `classic` skin in `assets/style.css`.

## Files

- `assets/skins/skins.css` - shared skin switcher styles
- `assets/skins/skins.json` - skin registry and stable IDs
- `assets/skins/skin-loader.js` - localStorage-backed skin selector
- `assets/skins/skaixu-ide.css` - skAIxu IDE-inspired neon operator skin
- `assets/skins/sol-ops.css` - warmer SOL operations skin
- `assets/skins/focus.css` - quieter dense work skin
- `scripts/verify-skins.mjs` - contract check for skin files, selector wiring, and scope safety

## Contract

- Active skin is stored in `localStorage` as `SKYEGATEFS13_SKIN`.
- The active skin is applied on `<html data-skye-skin="...">`.
- New skins should scope all overrides to `html[data-skye-skin="skin-name"]`.
- Do not edit `assets/style.css` to create skins unless changing the default classic look intentionally.

## Verification

Run:

```bash
npm run verify:skins
```

This confirms:

- all registered skin files exist
- selector options match `skins.json`
- non-classic skins are scoped
- the loader and pre-render skin hook are present
