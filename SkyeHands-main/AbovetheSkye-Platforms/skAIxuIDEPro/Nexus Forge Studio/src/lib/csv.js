// Kaixu App Base — tiny CSV helper

function esc(v) {
  const s = String(v ?? "");
  // Escape quotes by doubling them; wrap in quotes if needed.
  const needs = /[",\n\r]/.test(s);
  const out = s.replaceAll('"', '""');
  return needs ? `"${out}"` : out;
}

export function rowsToCSV(rows) {
  return rows.map(row => row.map(esc).join(",")).join("\n");
}
