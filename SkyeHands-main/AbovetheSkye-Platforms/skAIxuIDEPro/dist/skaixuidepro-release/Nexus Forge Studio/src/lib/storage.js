// Kaixu App Base — offline-first helpers (no dependencies)
//
// This storage key auto-derives from the page title so you can host multiple
// Kaixu apps under the same domain/path without localStorage collisions.

const FALLBACK_KEY = "KAIXU_APP_STATE_V1";

function safeTitleKey() {
  try {
    const t = String(document?.title || "").trim();
    if (!t) return FALLBACK_KEY;
    const slug = t
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return `KAIXU_${slug}_STATE_V1`;
  } catch {
    return FALLBACK_KEY;
  }
}

function clone(x) {
  try {
    // Modern browsers
    if (typeof structuredClone === "function") return structuredClone(x);
  } catch {}
  // Fallback
  return JSON.parse(JSON.stringify(x));
}

export function loadState(defaultState) {
  const key = safeTitleKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return clone(defaultState);
    // Merge so upgrades don't nuke user data
    return { ...clone(defaultState), ...parsed };
  } catch {
    return clone(defaultState);
  }
}

export function saveState(state) {
  const key = safeTitleKey();
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
