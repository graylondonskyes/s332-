const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { canonicalize } = require('./export-import');

function nowIso() { return new Date().toISOString(); }
function normalizeBase(endpoint) { return String(endpoint || '').replace(/\/+$/, ''); }

function buildPortalPlan(job, config = {}) {
  const base = normalizeBase(config.endpoint);
  if (!base) throw new Error(`Portal endpoint missing for ${job.channel}.`);
  const uiBase = `${base}/portal-ui`;
  return canonicalize({
    schema: 'skye.portal.automation.plan',
    version: '3.3.0',
    channel: job.channel,
    title: job.title,
    slug: job.slug,
    ui_base: uiBase,
    package_path: job.package_path,
    steps: [
      { type:'goto', url:`${uiBase}/login` },
      { type:'fill', selector:'#operator', value: job.metadata.operator || 'Skyes Over London' },
      { type:'fill', selector:'#password', value: job.metadata.portal_password || 'portal-test-password' },
      { type:'click', selector:'#login-submit' },
      { type:'wait_for_url_contains', value:'/draft' },
      { type:'fill', selector:'#title', value: job.title },
      { type:'fill', selector:'#slug', value: job.slug },
      { type:'click', selector:'#draft-submit' },
      { type:'wait_for_url_contains', value:'/upload' },
      { type:'set_input_files', selector:'#package-file', file_path: job.package_path },
      { type:'click', selector:'#upload-submit' },
      { type:'wait_for_url_contains', value:'/review' },
      { type:'click', selector:'#attach-submit' },
      { type:'wait_for_selector', selector:'#attach-status[data-status="attached"]' },
      { type:'click', selector:'#submit-final' },
      { type:'wait_for_selector', selector:'#submission-reference' },
      { type:'text_content', selector:'#submission-reference', assign:'remote_reference' },
      { type:'goto', url:`${uiBase}/status` },
      { type:'click', selector:'#status-sync' },
      { type:'wait_for_selector', selector:'#remote-status' },
      { type:'text_content', selector:'#remote-status', assign:'remote_status' }
    ]
  });
}

function runPortalAutomation(plan, options = {}) {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'run-portal-automation.py');
  const workDir = options.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'skye-portal-automation-'));
  fs.mkdirSync(workDir, { recursive: true });
  const planPath = path.join(workDir, 'plan.json');
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return new Promise((resolve, reject) => {
    const child = spawn('python', [scriptPath, '--plan', planPath, '--output-dir', workDir], { stdio:['ignore','pipe','pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || 'Portal automation runner failed.'));
      try {
        const output = JSON.parse(stdout.trim());
        resolve(canonicalize({ schema:'skye.portal.automation.receipt', version:'3.3.0', executed_at: nowIso(), ...output }));
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = { buildPortalPlan, runPortalAutomation };
