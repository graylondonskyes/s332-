import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sha256Value(value) {
  return sha256Text(canonicalJson(value));
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function fileEntriesFromMap(filesMap) {
  return Object.keys(filesMap || {})
    .sort()
    .map(filePath => ({
      path: normalizePath(filePath),
      sha256: sha256Text(filesMap[filePath]),
      sizeBytes: Buffer.byteLength(String(filesMap[filePath]), 'utf8')
    }));
}

function diffSnapshots(previousSnapshot = {}, nextSnapshot = {}) {
  const previous = previousSnapshot.files || {};
  const next = nextSnapshot.files || {};
  const allPaths = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const fileChanges = [];
  for (const filePath of [...allPaths].sort()) {
    const before = previous[filePath];
    const after = next[filePath];
    if (before === after) continue;
    if (before === undefined) {
      fileChanges.push({ type: 'add', path: normalizePath(filePath), afterSha256: sha256Text(after), afterSizeBytes: Buffer.byteLength(String(after), 'utf8') });
      continue;
    }
    if (after === undefined) {
      fileChanges.push({ type: 'remove', path: normalizePath(filePath), beforeSha256: sha256Text(before), beforeSizeBytes: Buffer.byteLength(String(before), 'utf8') });
      continue;
    }
    fileChanges.push({
      type: 'change',
      path: normalizePath(filePath),
      beforeSha256: sha256Text(before),
      afterSha256: sha256Text(after),
      beforeSizeBytes: Buffer.byteLength(String(before), 'utf8'),
      afterSizeBytes: Buffer.byteLength(String(after), 'utf8')
    });
  }

  const previousTerminal = String(previousSnapshot.terminalOutput || '');
  const nextTerminal = String(nextSnapshot.terminalOutput || '');
  const terminalDelta = nextTerminal.startsWith(previousTerminal)
    ? nextTerminal.slice(previousTerminal.length)
    : nextTerminal;

  return {
    fileChanges,
    fileChangeCount: fileChanges.length,
    terminalDelta,
    terminalDeltaSha256: sha256Text(terminalDelta),
    terminalLength: nextTerminal.length
  };
}

function captureSnapshot(session) {
  return {
    files: deepClone(session.state.files),
    terminalOutput: String(session.state.terminalOutput || ''),
    explanationTrail: deepClone(session.state.explanations || [])
  };
}

function normalizeEventType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Replay event type is required.');
  }
  return normalized;
}

function applyEventToState(session, event) {
  const detail = event.detail || {};
  switch (event.type) {
    case 'planning':
      if (detail.summary) {
        session.state.explanations.push({ order: event.order, type: event.type, summary: detail.summary });
      }
      break;
    case 'file-read':
      session.state.lastReadPath = normalizePath(detail.filePath || '');
      break;
    case 'file-write': {
      const filePath = normalizePath(detail.filePath);
      session.state.files[filePath] = String(detail.content ?? '');
      session.state.explanations.push({ order: event.order, type: event.type, filePath, reason: detail.reason || 'file mutation' });
      break;
    }
    case 'command-start':
      session.state.command = detail.command || null;
      break;
    case 'command-exit':
    case 'test-failure':
    case 'policy-denial':
    case 'approval':
    case 'deploy':
    case 'runtime-transition': {
      const text = String(detail.terminalAppend || detail.output || detail.message || '');
      if (text) {
        session.state.terminalOutput += `${text.endsWith('\n') ? text : `${text}\n`}`;
      }
      if (detail.summary || detail.message) {
        session.state.explanations.push({ order: event.order, type: event.type, summary: detail.summary || detail.message });
      }
      break;
    }
    default:
      throw new Error(`Unsupported replay event type '${event.type}'.`);
  }
}

function eventStamp(order) {
  const base = Date.parse('2026-04-07T19:00:00.000Z');
  return new Date(base + (order * 1000)).toISOString();
}

export function createReplaySession(options = {}) {
  const initialFiles = Object.fromEntries(Object.entries(options.initialFiles || {}).map(([filePath, content]) => [normalizePath(filePath), String(content)]));
  const createdAt = options.createdAt || new Date().toISOString();
  const session = {
    metadata: {
      runId: String(options.runId || `replay-${Date.now()}`),
      workspaceId: String(options.workspaceId || 'local'),
      tenantId: String(options.tenantId || 'local'),
      model: String(options.model || 'kAIxU-Prime6.7'),
      policyMode: String(options.policyMode || 'standard'),
      budgetMode: String(options.budgetMode || 'balanced'),
      createdAt,
      forkedFrom: options.forkedFrom || null,
      forkedFromOrder: Number.isInteger(options.forkedFromOrder) ? options.forkedFromOrder : null,
      exportProfiles: ['debug', 'procurement', 'proof-pack']
    },
    state: {
      files: deepClone(initialFiles),
      terminalOutput: '',
      explanations: [],
      lastReadPath: null,
      command: null
    },
    initialFiles,
    events: [],
    checkpoints: []
  };
  return session;
}

export function appendReplayEvent(session, type, detail = {}) {
  const eventType = normalizeEventType(type);
  const order = session.events.length + 1;
  const event = {
    id: `${session.metadata.runId}-event-${String(order).padStart(4, '0')}`,
    order,
    at: eventStamp(order),
    type: eventType,
    detail: deepClone(detail)
  };
  applyEventToState(session, event);
  session.events.push(event);
  return event;
}

export function createReplayCheckpoint(session, label, detail = {}) {
  const snapshot = captureSnapshot(session);
  const previous = session.checkpoints.length ? session.checkpoints[session.checkpoints.length - 1].snapshot : { files: session.initialFiles, terminalOutput: '' };
  const diff = diffSnapshots(previous, snapshot);
  const checkpoint = {
    id: `${session.metadata.runId}-checkpoint-${String(session.checkpoints.length + 1).padStart(3, '0')}`,
    label: String(label || `checkpoint-${session.checkpoints.length + 1}`),
    order: session.events.length,
    at: eventStamp(session.events.length + session.checkpoints.length + 1),
    detail: deepClone(detail),
    snapshot,
    snapshotHash: sha256Value(snapshot),
    diff,
    diffHash: sha256Value(diff)
  };
  session.checkpoints.push(checkpoint);
  return checkpoint;
}

export function reconstructFileStateAtOrder(bundleOrSession, filePath, order) {
  const normalized = normalizePath(filePath);
  const initialFiles = bundleOrSession.initialFiles || {};
  let current = Object.prototype.hasOwnProperty.call(initialFiles, normalized) ? initialFiles[normalized] : undefined;
  const events = Array.isArray(bundleOrSession.events) ? bundleOrSession.events : [];
  for (const event of events) {
    if ((event.order || 0) > order) break;
    if (event.type === 'file-write' && normalizePath(event.detail?.filePath) === normalized) {
      current = String(event.detail?.content ?? '');
    }
  }
  return current;
}

export function reconstructTerminalOutputAtOrder(bundleOrSession, order) {
  const events = Array.isArray(bundleOrSession.events) ? bundleOrSession.events : [];
  let output = '';
  for (const event of events) {
    if ((event.order || 0) > order) break;
    if (['command-exit', 'test-failure', 'policy-denial', 'approval', 'deploy', 'runtime-transition'].includes(event.type)) {
      const text = String(event.detail?.terminalAppend || event.detail?.output || event.detail?.message || '');
      if (text) {
        output += `${text.endsWith('\n') ? text : `${text}\n`}`;
      }
    }
  }
  return output;
}

export function materializeReplayCheckpoint(bundleOrSession, checkpointIdOrOrder, targetDir) {
  const checkpoints = Array.isArray(bundleOrSession.checkpoints) ? bundleOrSession.checkpoints : [];
  const checkpoint = checkpoints.find(item => item.id === checkpointIdOrOrder || item.order === checkpointIdOrOrder);
  if (!checkpoint) {
    throw new Error(`Replay checkpoint '${checkpointIdOrOrder}' was not found.`);
  }
  ensureDirectory(targetDir);
  for (const [filePath, content] of Object.entries(checkpoint.snapshot.files || {})) {
    const absolute = path.join(targetDir, filePath);
    ensureDirectory(path.dirname(absolute));
    fs.writeFileSync(absolute, String(content), 'utf8');
  }
  return {
    ok: true,
    checkpointId: checkpoint.id,
    targetDir,
    fileCount: Object.keys(checkpoint.snapshot.files || {}).length
  };
}

export function buildReplayBundle(session, options = {}) {
  const checkpoints = session.checkpoints.map(checkpoint => ({
    id: checkpoint.id,
    label: checkpoint.label,
    order: checkpoint.order,
    at: checkpoint.at,
    detail: checkpoint.detail,
    snapshot: checkpoint.snapshot,
    snapshotHash: checkpoint.snapshotHash,
    diff: checkpoint.diff,
    diffHash: checkpoint.diffHash
  }));
  return {
    version: 1,
    generatedAt: options.generatedAt || new Date().toISOString(),
    metadata: deepClone(session.metadata),
    initialFiles: deepClone(session.initialFiles),
    events: deepClone(session.events),
    eventDigest: sha256Value(session.events),
    checkpoints,
    checkpointDigest: sha256Value(checkpoints.map(item => ({ id: item.id, order: item.order, snapshotHash: item.snapshotHash, diffHash: item.diffHash }))),
    finalState: {
      files: deepClone(session.state.files),
      terminalOutput: String(session.state.terminalOutput || ''),
      explanations: deepClone(session.state.explanations),
      fileEntries: fileEntriesFromMap(session.state.files)
    }
  };
}

export function generateReplayTimelineHtml(bundle) {
  const safeJson = JSON.stringify(bundle).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SkyeReplay Timeline</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{margin:0;background:#080b12;color:#f4f7ff;font-family:Inter,Arial,sans-serif}
    main{padding:24px;max-width:1280px;margin:0 auto}
    .card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:16px 18px;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}
    button{border-radius:999px;padding:8px 12px;border:1px solid rgba(255,255,255,.14);background:#131a2a;color:#fff;cursor:pointer;margin:4px 6px 0 0}
    pre{white-space:pre-wrap;word-break:break-word;background:#0e1320;padding:12px;border-radius:14px;max-height:320px;overflow:auto}
    input[type=range]{width:100%}
    ul{padding-left:18px}
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>SkyeReplay Timeline</h1>
      <p>Run: <strong id="run-id"></strong></p>
      <input id="scrubber" type="range" min="1" max="1" value="1" />
      <p>Step <strong id="step-label"></strong></p>
      <div id="checkpoint-buttons"></div>
    </div>
    <div class="grid">
      <div>
        <div class="card"><h2>Event List</h2><ul id="event-list"></ul></div>
        <div class="card"><h2>Diff View</h2><pre id="diff-view"></pre></div>
      </div>
      <div>
        <div class="card"><h2>Terminal View</h2><pre id="terminal-view"></pre></div>
        <div class="card"><h2>Checkpoint Jump Controls</h2><pre id="checkpoint-view"></pre></div>
      </div>
    </div>
  </main>
  <script type="application/json" id="replay-data">${safeJson}</script>
  <script>
    const bundle = JSON.parse(document.getElementById('replay-data').textContent);
    const scrubber = document.getElementById('scrubber');
    const runId = document.getElementById('run-id');
    const stepLabel = document.getElementById('step-label');
    const eventList = document.getElementById('event-list');
    const diffView = document.getElementById('diff-view');
    const terminalView = document.getElementById('terminal-view');
    const checkpointView = document.getElementById('checkpoint-view');
    const checkpointButtons = document.getElementById('checkpoint-buttons');
    runId.textContent = bundle.metadata.runId;
    scrubber.max = Math.max(1, bundle.events.length);
    function render(step){
      const active = bundle.events.filter(event => event.order <= step);
      stepLabel.textContent = String(step);
      eventList.innerHTML = active.map(event => '<li>#' + event.order + ' — ' + event.type + '</li>').join('');
      const checkpoint = [...bundle.checkpoints].reverse().find(item => item.order <= step) || null;
      diffView.textContent = checkpoint ? JSON.stringify(checkpoint.diff, null, 2) : 'No checkpoint diff yet.';
      const terminal = active.filter(event => ['command-exit','test-failure','policy-denial','approval','deploy','runtime-transition'].includes(event.type)).map(event => event.detail.terminalAppend || event.detail.output || event.detail.message || '').join('');
      terminalView.textContent = terminal || 'No terminal output yet.';
      checkpointView.textContent = checkpoint ? JSON.stringify({ id: checkpoint.id, label: checkpoint.label, order: checkpoint.order }, null, 2) : 'No checkpoint selected.';
    }
    checkpointButtons.innerHTML = bundle.checkpoints.map(item => '<button data-order="' + item.order + '">' + item.label + '</button>').join('');
    checkpointButtons.addEventListener('click', event => {
      const order = event.target?.dataset?.order;
      if (!order) return;
      scrubber.value = order;
      render(Number(order));
    });
    scrubber.addEventListener('input', () => render(Number(scrubber.value)));
    render(Number(scrubber.value));
  </script>
</body>
</html>`;
}

export function exportReplayBundle(session, outputDir) {
  ensureDirectory(outputDir);
  const bundle = buildReplayBundle(session);
  const bundleFile = writeJson(path.join(outputDir, 'replay-bundle.json'), bundle);
  const timelineFile = path.join(outputDir, 'replay-timeline.html');
  fs.writeFileSync(timelineFile, generateReplayTimelineHtml(bundle), 'utf8');
  const checkpointsDir = path.join(outputDir, 'checkpoints');
  ensureDirectory(checkpointsDir);
  const checkpointFiles = [];
  for (const checkpoint of bundle.checkpoints) {
    const filePath = writeJson(path.join(checkpointsDir, `${checkpoint.id}.json`), checkpoint);
    checkpointFiles.push(filePath);
  }
  return {
    ok: true,
    bundle,
    bundleFile,
    timelineFile,
    checkpointFiles
  };
}

export function verifyReplayBundle(bundleOrFile) {
  const bundle = typeof bundleOrFile === 'string' ? readJson(bundleOrFile) : bundleOrFile;
  if (!bundle || typeof bundle !== 'object') {
    return { ok: false, reason: 'invalid_bundle' };
  }
  const events = Array.isArray(bundle.events) ? bundle.events : [];
  for (let index = 0; index < events.length; index += 1) {
    const expectedOrder = index + 1;
    if ((events[index]?.order || 0) !== expectedOrder) {
      return { ok: false, reason: 'out_of_order_event', index, expectedOrder, actualOrder: events[index]?.order || 0 };
    }
  }
  const expectedEventDigest = sha256Value(events);
  if (expectedEventDigest !== bundle.eventDigest) {
    return { ok: false, reason: 'event_digest_mismatch', expectedEventDigest, actualEventDigest: bundle.eventDigest || null };
  }
  const checkpoints = Array.isArray(bundle.checkpoints) ? bundle.checkpoints : [];
  for (const checkpoint of checkpoints) {
    const expectedSnapshotHash = sha256Value(checkpoint.snapshot || {});
    if (checkpoint.snapshotHash !== expectedSnapshotHash) {
      return { ok: false, reason: 'checkpoint_snapshot_mismatch', checkpointId: checkpoint.id, expectedSnapshotHash, actualSnapshotHash: checkpoint.snapshotHash || null };
    }
    const expectedDiffHash = sha256Value(checkpoint.diff || {});
    if (checkpoint.diffHash !== expectedDiffHash) {
      return { ok: false, reason: 'checkpoint_diff_mismatch', checkpointId: checkpoint.id, expectedDiffHash, actualDiffHash: checkpoint.diffHash || null };
    }
  }
  const expectedCheckpointDigest = sha256Value(checkpoints.map(item => ({ id: item.id, order: item.order, snapshotHash: item.snapshotHash, diffHash: item.diffHash })));
  if (expectedCheckpointDigest !== bundle.checkpointDigest) {
    return { ok: false, reason: 'checkpoint_digest_mismatch', expectedCheckpointDigest, actualCheckpointDigest: bundle.checkpointDigest || null };
  }
  return { ok: true, reason: 'verified', eventDigest: expectedEventDigest, checkpointDigest: expectedCheckpointDigest };
}

export function forkReplaySession(bundleOrFile, order, options = {}) {
  const bundle = typeof bundleOrFile === 'string' ? readJson(bundleOrFile) : bundleOrFile;
  const session = createReplaySession({
    runId: options.runId || `${bundle.metadata?.runId || 'replay'}-fork`,
    workspaceId: options.workspaceId || bundle.metadata?.workspaceId || 'local',
    tenantId: options.tenantId || bundle.metadata?.tenantId || 'local',
    model: options.model || bundle.metadata?.model || 'kAIxU-Prime6.7',
    policyMode: options.policyMode || bundle.metadata?.policyMode || 'standard',
    budgetMode: options.budgetMode || bundle.metadata?.budgetMode || 'balanced',
    initialFiles: bundle.initialFiles || {},
    forkedFrom: bundle.metadata?.runId || null,
    forkedFromOrder: order
  });
  for (const event of bundle.events || []) {
    if ((event.order || 0) > order) break;
    appendReplayEvent(session, event.type, event.detail || {});
  }
  createReplayCheckpoint(session, options.checkpointLabel || `fork-base-${order}`, { sourceCheckpointOrder: order });
  return session;
}

export function createReplayExportBundle(rootDir, bundleInfo, outputDir) {
  const exportPayload = {
    generatedAt: new Date().toISOString(),
    replayBundle: path.relative(rootDir, bundleInfo.bundleFile),
    timelineUi: path.relative(rootDir, bundleInfo.timelineFile),
    checkpointFiles: bundleInfo.checkpointFiles.map(filePath => path.relative(rootDir, filePath)),
    bundleSha256: sha256Text(fs.readFileSync(bundleInfo.bundleFile, 'utf8')),
    timelineSha256: sha256Text(fs.readFileSync(bundleInfo.timelineFile, 'utf8')),
    profiles: ['debug', 'procurement', 'proof-pack']
  };
  const exportFile = writeJson(path.join(outputDir, 'replay-export-bundle.json'), exportPayload);
  return {
    ok: true,
    exportFile,
    payload: exportPayload
  };
}
