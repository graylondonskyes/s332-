import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanWorkspaceFromPath } = require('../extensions/dead-route-detector-skyevsx/lib/scanner');
const reportTools = require('../shared/report-tools.js');

function usage() {
  return [
    'Dead Route Detector CLI',
    '',
    'Scan a folder or zip archive:',
    '  node scripts/cli.mjs scan <target> [--json out.json] [--markdown out.md] [--sarif out.sarif] [--summary]',
    '',
    'Compare two report JSON files:',
    '  node scripts/cli.mjs compare --baseline base.json --candidate cand.json [--json out.json] [--markdown out.md]',
    '',
    'Generate a pull-request review comment markdown from two report JSON files:',
    '  node scripts/cli.mjs review-comment --baseline base.json --candidate cand.json [--markdown out.md] [--owner acme --repo route-lab --pull 17]',
    '',
    'Exit codes:',
    '  0 = success with no findings or regressions',
    '  1 = usage or runtime error',
    '  2 = scan completed with findings',
    '  3 = compare completed with regressions'
  ].join('\n');
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = next;
        i += 1;
      }
    } else {
      result._.push(token);
    }
  }
  return result;
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function resolveScanRoot(unzipRoot) {
  const entries = fs.readdirSync(unzipRoot, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory());
  if (dirs.length === 1) return path.join(unzipRoot, dirs[0].name);
  return unzipRoot;
}

function withScanRoot(targetPath, callback) {
  const absolute = path.resolve(targetPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Target not found: ${absolute}`);
  }
  if (fs.statSync(absolute).isDirectory()) {
    return callback(absolute);
  }
  if (/\.zip$/i.test(absolute)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-route-detector-cli-'));
    execFileSync('unzip', ['-q', absolute, '-d', tmpDir]);
    return callback(resolveScanRoot(tmpDir));
  }
  throw new Error(`Unsupported target type: ${absolute}`);
}

function printSummary(report) {
  const commandIssues = (report.summary.unregisteredContributedCommands || 0)
    + (report.summary.deadExecutedCommands || 0)
    + (report.summary.deadMenuCommands || 0)
    + (report.summary.deadKeybindingCommands || 0);
  console.log(JSON.stringify({
    workspaceName: report.workspaceName,
    filesScanned: report.summary.filesScanned,
    deadRouteReferences: report.summary.deadRouteReferences,
    orphanRoutes: report.summary.orphanRoutes,
    placeholderControls: report.summary.placeholderControls,
    deadCommandFindings: commandIssues
  }, null, 2));
}

function scanCommand(args) {
  const target = args._[1];
  if (!target) throw new Error('scan requires a folder or zip target');
  const report = withScanRoot(target, (scanRoot) => scanWorkspaceFromPath(scanRoot, { workspaceName: path.basename(scanRoot) }));

  if (args.json && typeof args.json === 'string') writeFile(path.resolve(args.json), JSON.stringify(report, null, 2));
  if (args.markdown && typeof args.markdown === 'string') writeFile(path.resolve(args.markdown), reportTools.renderReportMarkdown(report));
  if (args.sarif && typeof args.sarif === 'string') writeFile(path.resolve(args.sarif), JSON.stringify(reportTools.toSarif(report), null, 2));
  if (args.summary) printSummary(report);

  const issueCount = reportTools.collectIssues(report).length;
  return { code: issueCount > 0 ? 2 : 0, report };
}

function compareCommand(args) {
  const baselinePath = args.baseline;
  const candidatePath = args.candidate;
  if (!baselinePath || !candidatePath || baselinePath === true || candidatePath === true) {
    throw new Error('compare requires --baseline <report.json> and --candidate <report.json>');
  }
  const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'));
  const candidate = JSON.parse(fs.readFileSync(path.resolve(candidatePath), 'utf8'));
  const diff = reportTools.compareReports(baseline, candidate);
  if (args.json && typeof args.json === 'string') writeFile(path.resolve(args.json), JSON.stringify(diff, null, 2));
  if (args.markdown && typeof args.markdown === 'string') writeFile(path.resolve(args.markdown), reportTools.renderDiffMarkdown(diff));
  console.log(JSON.stringify({
    baselineWorkspace: diff.baselineWorkspace,
    candidateWorkspace: diff.candidateWorkspace,
    addedIssueCount: diff.addedIssueCount,
    resolvedIssueCount: diff.resolvedIssueCount
  }, null, 2));
  return { code: diff.addedIssueCount > 0 ? 3 : 0, diff };
}


function reviewCommentCommand(args) {
  const baselinePath = args.baseline;
  const candidatePath = args.candidate;
  if (!baselinePath || !candidatePath || baselinePath === true || candidatePath === true) {
    throw new Error('review-comment requires --baseline <report.json> and --candidate <report.json>');
  }
  const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'));
  const candidate = JSON.parse(fs.readFileSync(path.resolve(candidatePath), 'utf8'));
  const diff = reportTools.compareReports(baseline, candidate);
  const markdown = reportTools.renderPullRequestComment(diff, {
    owner: typeof args.owner === 'string' ? args.owner : '',
    repo: typeof args.repo === 'string' ? args.repo : '',
    pull: typeof args.pull === 'string' ? `#${String(args.pull).replace(/^#/, '')}` : ''
  });
  if (args.markdown && typeof args.markdown === 'string') writeFile(path.resolve(args.markdown), markdown);
  console.log(markdown);
  return { code: diff.addedIssueCount > 0 ? 3 : 0, diff };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || args.help) {
    console.log(usage());
    process.exit(command ? 0 : 1);
  }
  let result;
  if (command === 'scan') {
    result = scanCommand(args);
  } else if (command === 'compare') {
    result = compareCommand(args);
  } else if (command === 'review-comment') {
    result = reviewCommentCommand(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
  process.exit(result.code);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  console.error(usage());
  process.exit(1);
}
