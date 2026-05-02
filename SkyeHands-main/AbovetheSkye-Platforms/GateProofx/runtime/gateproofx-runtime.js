(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GateProofxRuntime = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VIEW_KEY = "gateProofxViews";
  const HISTORY_KEY = "gateProofxImports";
  const SNAPSHOT_KEY = "gateProofxImportSnapshots";

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

  function saveView(storage, payload) {
    const next = {
      id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: String(payload.label || "Saved view").trim(),
      filters: payload.filters || {},
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const current = read(storage, VIEW_KEY).filter((item) => item.id !== next.id);
    current.unshift(next);
    write(storage, VIEW_KEY, current.slice(0, 12));
    return next;
  }

  function listViews(storage) {
    return read(storage, VIEW_KEY);
  }

  function recordImport(storage, payload) {
    const next = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source: String(payload.source || "upload"),
      rowCount: Number(payload.rowCount || 0),
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const current = read(storage, HISTORY_KEY);
    current.unshift(next);
    write(storage, HISTORY_KEY, current.slice(0, 20));
    return next;
  }

  function listImports(storage) {
    return read(storage, HISTORY_KEY);
  }

  function saveImportSnapshot(storage, payload) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const next = {
      id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      source: String(payload.source || "upload"),
      rowCount: rows.length,
      rows,
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const current = read(storage, SNAPSHOT_KEY).filter((item) => item.id !== next.id);
    current.unshift(next);
    write(storage, SNAPSHOT_KEY, current.slice(0, 8));
    return next;
  }

  function listImportSnapshots(storage) {
    return read(storage, SNAPSHOT_KEY).map(({ rows, ...rest }) => ({
      ...rest,
      rowCount: Number(rest.rowCount || (Array.isArray(rows) ? rows.length : 0)),
    }));
  }

  function getImportSnapshot(storage, snapshotId) {
    return read(storage, SNAPSHOT_KEY).find((item) => item.id === snapshotId) || null;
  }

  function summarizeQuality(rows) {
    const duplicateRequestIds = new Set();
    const seenRequestIds = new Set();
    let missingProvider = 0;
    let missingModel = 0;
    let errorRows = 0;

    rows.forEach((row) => {
      const requestId = String(row.request_id || "").trim();
      if (requestId) {
        if (seenRequestIds.has(requestId)) duplicateRequestIds.add(requestId);
        seenRequestIds.add(requestId);
      }
      if (!String(row.provider || "").trim()) missingProvider += 1;
      if (!String(row.model || "").trim()) missingModel += 1;
      if (String(row.level || "").toLowerCase() === "error") errorRows += 1;
    });

    return {
      duplicateRequestIds: duplicateRequestIds.size,
      missingProvider,
      missingModel,
      errorRows,
    };
  }

  return {
    saveView,
    listViews,
    recordImport,
    listImports,
    saveImportSnapshot,
    listImportSnapshots,
    getImportSnapshot,
    summarizeQuality,
  };
});
