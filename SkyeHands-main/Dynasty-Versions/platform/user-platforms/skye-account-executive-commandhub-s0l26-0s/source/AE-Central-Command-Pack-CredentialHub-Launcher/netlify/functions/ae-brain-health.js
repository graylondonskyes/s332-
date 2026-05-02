const fs = require('node:fs');
const path = require('node:path');
const { listRecords } = require('./_shared/ae_runtime_db');
const { listSmokeReports, writeUsageEvent } = require('./_shared/ae_state');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const graychunksFindingsPath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-findings.json');
const graychunksQueuePath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-priority-queue.json');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

module.exports.handler = async () => {
  const tasks = listRecords('tasks');
  const clients = listRecords('clients');
  const smokeReports = await listSmokeReports(10);
  const latestSmoke = smokeReports[0] || null;
  const graychunksFindings = readJson(graychunksFindingsPath);
  const graychunksQueue = readJson(graychunksQueuePath);

  const health = {
    ok: true,
    service: 'ae-brain-health',
    checkedAt: new Date().toISOString(),
    dataShape: {
      clientCount: clients.length,
      taskCount: tasks.length,
      latestSmokeStatus: latestSmoke?.status || 'unknown',
      graychunksIssueCount: graychunksFindings?.issueCount ?? null,
      graychunksQueueCount: graychunksQueue?.queuedIssues ?? null
    }
  };

  await writeUsageEvent({ route: 'ae-brain-health', action: 'health_check', detail: health.dataShape });
  return json(200, health);
};
