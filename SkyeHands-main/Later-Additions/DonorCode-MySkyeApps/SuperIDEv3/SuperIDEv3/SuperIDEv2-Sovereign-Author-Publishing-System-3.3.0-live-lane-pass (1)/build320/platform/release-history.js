const { canonicalize } = require('./export-import');

function nowIso(){ return new Date().toISOString(); }
function deepClone(value){ return JSON.parse(JSON.stringify(value)); }

function emptyReleaseHistory() {
  return canonicalize({
    schema: 'skye.release.history',
    version: '3.2.0',
    updated_at: nowIso(),
    runs: [],
    analytics: {
      runs_count: 0,
      successful_runs: 0,
      titles_count: 0,
      gross_usd: 0,
      total_library_items: 0,
      by_mode: { code: 0, skydocx: 0, skyeblog: 0 },
      last_run_id: null,
      last_release_slug: null,
      last_title_name: null,
      last_recorded_at: null
    }
  });
}

function recalcReleaseHistory(state) {
  const byMode = { code: 0, skydocx: 0, skyeblog: 0 };
  let successfulRuns = 0;
  let grossUsd = 0;
  let totalLibraryItems = 0;
  const titles = new Set();
  for (const run of state.runs) {
    if (Object.prototype.hasOwnProperty.call(byMode, run.workspace_mode)) byMode[run.workspace_mode] += 1;
    if (run.smoke_ok) successfulRuns += 1;
    grossUsd += Number(run.checkout_amount_usd || 0);
    totalLibraryItems += Number(run.library_count || 0);
    if (run.title_id) titles.add(run.title_id);
  }
  const latest = state.runs[state.runs.length - 1] || null;
  state.analytics = {
    runs_count: state.runs.length,
    successful_runs: successfulRuns,
    titles_count: titles.size,
    gross_usd: grossUsd,
    total_library_items: totalLibraryItems,
    by_mode: byMode,
    last_run_id: latest ? latest.run_id : null,
    last_release_slug: latest ? latest.author_release_slug || latest.blog_release_slug || null : null,
    last_title_name: latest ? latest.title_name || null : null,
    last_recorded_at: latest ? latest.recorded_at : null
  };
  state.updated_at = nowIso();
  return state;
}

function ensureReleaseHistory(value) {
  const base = value && value.schema === 'skye.release.history' ? deepClone(value) : emptyReleaseHistory();
  base.runs = Array.isArray(base.runs) ? base.runs : [];
  return recalcReleaseHistory(base);
}

function recordPublishingRun(state, payload = {}) {
  const base = ensureReleaseHistory(state);
  const run = canonicalize({
    schema: 'skye.release.run',
    version: '3.2.0',
    run_id: payload.run_id || `release-${Date.now()}`,
    recorded_at: payload.recorded_at || nowIso(),
    operator: payload.operator || 'Operator',
    org: payload.org || 'Org',
    title_id: payload.title_id || null,
    title_name: payload.title_name || 'Untitled Workspace',
    workspace_mode: payload.workspace_mode || 'code',
    author_release_slug: payload.author_release_slug || null,
    blog_release_slug: payload.blog_release_slug || null,
    checkout_amount_usd: Number(payload.checkout_amount_usd || 0),
    orders_count: Number(payload.orders_count || 0),
    library_count: Number(payload.library_count || 0),
    package_bytes: Number(payload.package_bytes || 0),
    export_bytes: Number(payload.export_bytes || 0),
    smoke_ok: payload.smoke_ok === true,
    notes: payload.notes || ''
  });
  base.runs.push(run);
  return canonicalize(recalcReleaseHistory(base));
}

function summarizeReleaseHistory(state) {
  const base = ensureReleaseHistory(state);
  return canonicalize({
    schema: 'skye.release.history.summary',
    version: '3.2.0',
    updated_at: base.updated_at,
    runs_count: base.analytics.runs_count,
    successful_runs: base.analytics.successful_runs,
    titles_count: base.analytics.titles_count,
    gross_usd: base.analytics.gross_usd,
    total_library_items: base.analytics.total_library_items,
    by_mode: base.analytics.by_mode,
    last_run_id: base.analytics.last_run_id,
    last_release_slug: base.analytics.last_release_slug,
    last_title_name: base.analytics.last_title_name
  });
}

module.exports = { emptyReleaseHistory, ensureReleaseHistory, recordPublishingRun, summarizeReleaseHistory };
