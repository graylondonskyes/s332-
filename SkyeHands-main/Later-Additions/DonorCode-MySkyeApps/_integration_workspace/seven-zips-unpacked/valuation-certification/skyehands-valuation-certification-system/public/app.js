const state = {
  workspaceId: null,
  downloads: {},
  report: null,
};

const form = document.getElementById('uploadForm');
const zipInput = document.getElementById('zipInput');
const patchBtn = document.getElementById('patchBtn');
const statusBox = document.getElementById('statusBox');
const workspaceSummary = document.getElementById('workspaceSummary');
const scoreBars = document.getElementById('scoreBars');
const issuesTableWrap = document.getElementById('issuesTableWrap');
const downloadsBox = document.getElementById('downloads');

function setStatus(message, tone = 'neutral') {
  statusBox.className = 'status-box';
  if (tone === 'error') statusBox.classList.add('error');
  if (tone === 'success') statusBox.classList.add('success');
  statusBox.textContent = message;
}

function money(value) {
  const number = Number(value || 0);
  return `$${number.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function renderSummary(workspace, report) {
  const runtime = report?.runtimeProof || {};
  const patchLab = workspace?.patchLab || {};
  workspaceSummary.innerHTML = `
    <div><dt>Status</dt><dd>${workspace?.status || '—'}</dd></div>
    <div><dt>Workspace ID</dt><dd>${workspace?.workspaceId || '—'}</dd></div>
    <div><dt>Certification</dt><dd>${report?.valuation?.certification?.label || '—'}</dd></div>
    <div><dt>Issued value</dt><dd>${money(report?.valuation?.values?.issuedSkyeHandsCertificationValue)}</dd></div>
    <div><dt>Runtime proof</dt><dd>${runtime?.status || '—'} · ${runtime?.passedCheckCount || 0}/${runtime?.executedCheckCount || 0} passed</dd></div>
    <div><dt>Patch uplift</dt><dd>${patchLab?.issuedValueDelta ? money(patchLab.issuedValueDelta) : '—'}</dd></div>
    <div><dt>Authority</dt><dd>${report?.authority?.verification?.verified ? 'verified' : '—'}</dd></div>
    <div><dt>Runtime matrix</dt><dd>${report?.runtimeMatrix?.overallStatus || '—'} · ${report?.runtimeMatrix?.provenRuntimeCount || 0}/${report?.runtimeMatrix?.supportedRuntimeCount || 0} proven</dd></div>
    <div><dt>Execution matrix</dt><dd>${report?.executionMatrix?.overallStatus || '—'} · ${report?.executionMatrix?.passedCommandCount || 0}/${report?.executionMatrix?.executedCommandCount || 0} passed</dd></div>
    <div><dt>Completion</dt><dd>${report?.completionLedger?.completionPercent ?? '—'}% complete · ${report?.completionLedger?.distanceToClosePercent ?? '—'}% open</dd></div>
    <div><dt>Repair lane</dt><dd>${report?.repairIntelligence?.mode || '—'} · ${report?.repairIntelligence?.patchableCount ?? 0} patchable</dd></div>
    <div><dt>Trust chain</dt><dd>${report?.publicTrustChain?.verification?.verified || report?.publicTrustChain?.verified ? 'verified local chain' : '—'}</dd></div>
    <div><dt>Portfolio score</dt><dd>${report?.workspacePortfolio?.portfolioScore ?? '—'}</dd></div>
  `;
}

function renderScores(report) {
  const scores = report?.valuation?.methodScores || {};
  const rows = Object.entries(scores).map(([name, value]) => {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    return `
      <div class="score-row">
        <div class="score-label"><span>${name.replace(/_/g, ' ')}</span><strong>${safe.toFixed(1)}</strong></div>
        <div class="score-track"><div class="score-fill" style="width:${safe}%"></div></div>
      </div>
    `;
  });
  scoreBars.innerHTML = rows.join('') || '<div class="empty-state">No scores yet.</div>';
}

function renderIssues(report) {
  const issues = report?.issues || [];
  if (!issues.length) {
    issuesTableWrap.innerHTML = '<div class="empty-state">No issues detected.</div>';
    return;
  }
  const rows = issues.map(issue => `
    <tr>
      <td>${issue.title}</td>
      <td>${issue.severity}</td>
      <td>${issue.patchable ? 'Yes' : 'No'}</td>
      <td>${issue.detail}</td>
    </tr>
  `).join('');
  issuesTableWrap.innerHTML = `
    <table>
      <thead><tr><th>Issue</th><th>Severity</th><th>Patchable</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

function renderDownloads(downloads) {
  const entries = Object.entries(downloads || {});
  if (!entries.length) {
    downloadsBox.innerHTML = '<div class="empty-state">No artifacts yet.</div>';
    return;
  }
  downloadsBox.innerHTML = entries.map(([key, href]) => `
    <div class="download-item">
      <strong>${humanizeKey(key)}</strong>
      <div>${href.split('/').pop()}</div>
      <a href="${href}">Download</a>
    </div>
  `).join('');
}

function renderAll(payload) {
  state.workspaceId = payload.workspaceId || state.workspaceId;
  state.report = payload.report || state.report;
  state.downloads = payload.downloads || state.downloads;
  renderSummary(payload.workspace || {}, payload.report || {});
  renderScores(payload.report || {});
  renderIssues(payload.report || {});
  renderDownloads(payload.downloads || {});
  patchBtn.disabled = !state.workspaceId;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = zipInput.files?.[0];
  if (!file) {
    setStatus('Select a ZIP file before running the import.', 'error');
    return;
  }
  setStatus('Uploading ZIP and running scan…');
  patchBtn.disabled = true;
  try {
    const buffer = await file.arrayBuffer();
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': file.name,
        'X-Project-Label': document.getElementById('projectLabel').value,
        'X-Commercial-Profile': document.getElementById('commercialProfile').value,
        'X-Autonomy-Mode': document.getElementById('autonomyMode').value,
        'X-Patch-Mode': document.getElementById('patchMode').value,
      },
      body: buffer,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Import failed');
    renderAll(payload);
    setStatus(`Scan complete. Workspace ${payload.workspaceId} is ready.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Import failed.', 'error');
  }
});

patchBtn.addEventListener('click', async () => {
  if (!state.workspaceId) return;
  setStatus('Running patch lab and re-scan…');
  try {
    const response = await fetch(`/api/patch/${state.workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds: [] })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Patch lab failed');
    renderAll(payload);
    setStatus(`Patch lab complete. Applied ${payload.patchLab?.appliedPatchCount || 0} patch(es).`, 'success');
  } catch (error) {
    setStatus(error.message || 'Patch lab failed.', 'error');
  }
});

(async function bootstrap() {
  try {
    const response = await fetch('/api/health');
    const health = await response.json();
    if (health.ok) {
      setStatus('Platform healthy. Waiting for ZIP import.');
    }
  } catch (error) {
    setStatus('Server not reachable yet.', 'error');
  }
})();
