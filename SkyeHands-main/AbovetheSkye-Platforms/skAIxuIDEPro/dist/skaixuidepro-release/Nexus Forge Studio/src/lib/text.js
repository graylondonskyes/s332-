export function safeTrim(x) {
  return String(x ?? "").trim();
}

export function slugify(x) {
  const s = safeTrim(x).toLowerCase();
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function titleCase(x) {
  const s = safeTrim(x);
  if (!s) return "";
  return s
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function clampText(x, n) {
  const s = safeTrim(x);
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

export function joinNonEmpty(parts, sep = " • ") {
  return (parts || []).map(p => safeTrim(p)).filter(Boolean).join(sep);
}
