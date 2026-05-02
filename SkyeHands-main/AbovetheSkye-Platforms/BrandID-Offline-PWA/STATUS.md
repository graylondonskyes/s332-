# BrandID-Offline-PWA Status

- Classification: `shipped`
- Runnable surface: static offline-first brand identity generator, local SVG export controls, service worker, and manifest-driven install shell.
- Proof command: `node smoke/smoke-static-proof.mjs`
- What the proof covers: local shell assets, service-worker cache contract, export controls, and explicit offline/network limits in the UI.
- What it does not cover: first-load offline use before caching or contact-form submission without network.
