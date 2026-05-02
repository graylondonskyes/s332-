(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AEFlowJournal = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const KEY = "aeFlowOpsJournal";
  const MAX_ENTRIES = 80;

  function read(storage) {
    try {
      return JSON.parse(storage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function write(storage, value) {
    storage.setItem(KEY, JSON.stringify(value));
  }

  function record(storage, entry) {
    const next = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: String(entry.type || "event"),
      detail: String(entry.detail || ""),
      createdAt: entry.createdAt || new Date().toISOString(),
      meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
    };
    const current = read(storage);
    current.unshift(next);
    write(storage, current.slice(0, MAX_ENTRIES));
    return next;
  }

  function list(storage) {
    return read(storage);
  }

  function clear(storage) {
    write(storage, []);
  }

  function exportBundle(storage, extras) {
    const entries = list(storage);
    return {
      exportedAt: new Date().toISOString(),
      source: "AE-FLOW-browser-journal",
      summary: summarize(entries),
      entries,
      extras: extras && typeof extras === "object" ? extras : {},
    };
  }

  function summarize(entries) {
    const tally = entries.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    return {
      total: entries.length,
      byType: tally,
      latestAt: entries[0] && entries[0].createdAt ? entries[0].createdAt : null,
    };
  }

  return { record, list, clear, summarize, exportBundle };
});
