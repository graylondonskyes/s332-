const REPORTS_KEY = "repoLiveReports";
const PRESETS_KEY = "repoLiveCommandPresets";
const MAX_REPORTS = 20;
const MAX_PRESETS = 12;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

export function listCommandPresets(storage) {
  return safeArray(readJson(storage, PRESETS_KEY));
}

export function saveCommandPreset(storage, preset) {
  const next = {
    id: String(preset.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    label: String(preset.label || preset.command || "Unnamed preset").trim(),
    command: String(preset.command || "").trim(),
    subdir: String(preset.subdir || ".").trim() || ".",
    createdAt: preset.createdAt || new Date().toISOString(),
  };
  if (!next.command) throw new Error("Command preset requires a command.");
  const current = listCommandPresets(storage).filter((item) => item.id !== next.id);
  current.unshift(next);
  writeJson(storage, PRESETS_KEY, current.slice(0, MAX_PRESETS));
  return next;
}

export function removeCommandPreset(storage, presetId) {
  writeJson(storage, PRESETS_KEY, listCommandPresets(storage).filter((item) => item.id !== presetId));
}

export function listReports(storage) {
  return safeArray(readJson(storage, REPORTS_KEY));
}

export function summarizeRunReport(report) {
  const log = String(report.log || "");
  return {
    errors: (log.match(/\berror\b/gi) || []).length,
    warnings: (log.match(/\bwarn(ing)?\b/gi) || []).length,
    signals: (log.match(/\b(pass|passed|fail|failed)\b/gi) || []).length,
    logBytes: log.length,
  };
}

export function saveRunReport(storage, report) {
  const next = {
    id: String(report.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    sourceType: report.sourceType || "unknown",
    sourceName: report.sourceName || "",
    packageJson: report.packageJson || ".",
    subdir: report.subdir || ".",
    command: report.command || "",
    exitCode: Number.isFinite(report.exitCode) ? report.exitCode : null,
    ok: Boolean(report.ok),
    startedAt: report.startedAt || new Date().toISOString(),
    endedAt: report.endedAt || new Date().toISOString(),
    log: String(report.log || ""),
    summary: summarizeRunReport(report),
  };
  const current = listReports(storage).filter((item) => item.id !== next.id);
  current.unshift(next);
  writeJson(storage, REPORTS_KEY, current.slice(0, MAX_REPORTS));
  return next;
}
