'use strict';
self.onmessage = event => {
  self.postMessage({ ok: true, runtime: 'skyequanta-editor-worker-fallback', echo: event?.data ?? null });
};
