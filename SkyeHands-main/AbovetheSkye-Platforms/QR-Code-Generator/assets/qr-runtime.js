(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QRRuntime = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PRESETS_KEY = "solQrPresets";
  const HISTORY_KEY = "solQrHistory";

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function read(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function write(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function validateConfig(config) {
    const text = String(config.text || "").trim();
    const size = Number.parseInt(config.size, 10);
    if (!text) throw new Error("QR content is required.");
    if (!Number.isFinite(size) || size < 120 || size > 2000) throw new Error("QR size must be between 120 and 2000 pixels.");
    return {
      text,
      size,
      fgColor: String(config.fgColor || "#000000"),
      bgColor: String(config.bgColor || "#ffffff"),
    };
  }

  function savePreset(storage, preset) {
    const config = validateConfig(preset);
    const next = {
      id: preset.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: String(preset.label || config.text).trim().slice(0, 80),
      ...config,
      createdAt: preset.createdAt || new Date().toISOString(),
    };
    const current = safeArray(read(storage, PRESETS_KEY)).filter((item) => item.id !== next.id);
    current.unshift(next);
    write(storage, PRESETS_KEY, current.slice(0, 12));
    return next;
  }

  function listPresets(storage) {
    return safeArray(read(storage, PRESETS_KEY));
  }

  function recordHistory(storage, entry) {
    const config = validateConfig(entry);
    const next = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...config,
      exportType: String(entry.exportType || "render"),
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    const current = safeArray(read(storage, HISTORY_KEY));
    current.unshift(next);
    write(storage, HISTORY_KEY, current.slice(0, 20));
    return next;
  }

  function listHistory(storage) {
    return safeArray(read(storage, HISTORY_KEY));
  }

  return { validateConfig, savePreset, listPresets, recordHistory, listHistory };
});
