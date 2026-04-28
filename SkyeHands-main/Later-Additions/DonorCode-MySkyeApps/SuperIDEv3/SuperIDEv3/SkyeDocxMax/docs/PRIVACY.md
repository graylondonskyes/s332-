# Privacy

The standalone SkyeDocxMax package stores documents locally by default.

- Documents, folders, versions, comments, suggestions, and assets are written to IndexedDB.
- Bridge actions write local outbox, intent, and evidence records when live Skye ecosystem routes are unavailable.
- No account is required for the core editor.
- CDN assets may be requested on first connected load unless already cached by the service worker or browser.

Users should export backups before clearing browser data or moving to another browser profile.

