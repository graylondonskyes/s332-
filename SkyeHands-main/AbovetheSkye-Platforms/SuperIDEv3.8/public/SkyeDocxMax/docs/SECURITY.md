# Security

SkyeDocxMax is local-first. Documents are stored in the browser IndexedDB for the origin that serves the app.

Security controls included in this standalone build:

- Encrypted `.skye` export/import using the bundled secure runtime.
- Visible failure for missing secure runtime, wrong passphrase, and failed encrypted save.
- DOMPurify sanitization for rendered document HTML when available.
- Local bridge fallback instead of silent remote success.
- Browser-origin storage isolation.

Limits:

- Browser storage can be cleared by the user, browser, or profile policy.
- Passphrases cannot be recovered if lost.
- True server-side audit, device policy, and provider secrets belong in the later SuperIDEv3 integration lane.

