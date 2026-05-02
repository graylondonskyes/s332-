const crypto = require('crypto');
const { canonicalize } = require('./export-import');

function nowIso(){ return new Date().toISOString(); }
function deepClone(value){ return JSON.parse(JSON.stringify(value)); }
function slugify(value){ return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'untitled'; }
function parseJson(files, name, fallback = {}) { try { return JSON.parse(files?.[name] || '{}'); } catch { return fallback; } }

function deriveWorkspaceTitle(workspace = {}) {
  const files = workspace.files || {};
  const metadata = parseJson(files, 'metadata.json', {});
  const channel = parseJson(files, 'channel.json', {});
  if (metadata.title) return metadata.title;
  if (channel.channelTitle) return channel.channelTitle;
  if (workspace.mode === 'skyeblog') return 'Untitled SkyeBlog Release';
  if (workspace.mode === 'skydocx') return 'Untitled SkyeDocx Release';
  return 'Untitled Workspace';
}

function emptyCatalogState() {
  return canonicalize({
    schema: 'skye.catalog.state',
    version: '3.2.0',
    updated_at: nowIso(),
    active_title_id: null,
    titles: [],
    analytics: { titles_count: 0, active_title_name: null, by_mode: { code: 0, skydocx: 0, skyeblog: 0 } }
  });
}

function recalcCatalogAnalytics(state) {
  const titles = Array.isArray(state.titles) ? state.titles : [];
  const byMode = { code: 0, skydocx: 0, skyeblog: 0 };
  for (const entry of titles) {
    if (Object.prototype.hasOwnProperty.call(byMode, entry.workspace_mode)) byMode[entry.workspace_mode] += 1;
  }
  const active = titles.find((item) => item.title_id === state.active_title_id) || null;
  state.analytics = {
    titles_count: titles.length,
    active_title_name: active ? active.title_name : null,
    by_mode: byMode
  };
  state.updated_at = nowIso();
  return state;
}

function ensureCatalogState(value) {
  const base = value && value.schema === 'skye.catalog.state' ? deepClone(value) : emptyCatalogState();
  base.titles = Array.isArray(base.titles) ? base.titles : [];
  return recalcCatalogAnalytics(base);
}

function upsertCatalogTitle(state, workspace, options = {}) {
  const base = ensureCatalogState(state);
  const titleName = options.titleName || deriveWorkspaceTitle(workspace);
  const titleId = options.titleId || `title_${crypto.randomBytes(6).toString('hex')}`;
  const snapshot = canonicalize({
    title_id: titleId,
    title_name: titleName,
    title_slug: slugify(titleName),
    workspace_mode: workspace.mode || 'code',
    saved_at: nowIso(),
    files: deepClone(workspace.files || {}),
    publishing: deepClone(workspace.publishing || {}),
    commerce: deepClone(workspace.commerce || {}),
    notes: options.notes || ''
  });
  const idx = base.titles.findIndex((item) => item.title_id === titleId);
  if (idx >= 0) base.titles[idx] = snapshot;
  else base.titles.push(snapshot);
  base.active_title_id = titleId;
  return canonicalize(recalcCatalogAnalytics(base));
}

function activateCatalogTitle(state, titleId) {
  const base = ensureCatalogState(state);
  const title = base.titles.find((item) => item.title_id === titleId);
  if (!title) throw new Error(`Catalog title not found: ${titleId}`);
  base.active_title_id = titleId;
  recalcCatalogAnalytics(base);
  const workspace = canonicalize({
    mode: title.workspace_mode,
    files: deepClone(title.files || {}),
    publishing: deepClone(title.publishing || {}),
    commerce: deepClone(title.commerce || {})
  });
  return { state: canonicalize(base), workspace };
}

function summarizeCatalogState(state) {
  const base = ensureCatalogState(state);
  const active = base.titles.find((item) => item.title_id === base.active_title_id) || null;
  return canonicalize({
    schema: 'skye.catalog.summary',
    version: '3.2.0',
    updated_at: base.updated_at,
    titles_count: base.analytics.titles_count,
    active_title_id: base.active_title_id,
    active_title_name: active ? active.title_name : null,
    by_mode: base.analytics.by_mode,
    title_names: base.titles.map((item) => item.title_name)
  });
}

module.exports = { deriveWorkspaceTitle, emptyCatalogState, ensureCatalogState, upsertCatalogTitle, activateCatalogTitle, summarizeCatalogState };
