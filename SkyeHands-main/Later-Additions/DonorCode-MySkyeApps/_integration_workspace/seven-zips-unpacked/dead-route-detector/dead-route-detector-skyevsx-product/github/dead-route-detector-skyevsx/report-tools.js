(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DeadRouteReportTools = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ISSUE_TYPES = {
    deadRouteReferences: 'dead-route-reference',
    orphanRoutes: 'orphan-route',
    placeholderControls: 'placeholder-control',
    deadExecutedCommands: 'dead-executed-command',
    unregisteredContributedCommands: 'unregistered-contributed-command',
    deadMenuCommands: 'dead-menu-command',
    deadKeybindingCommands: 'dead-keybinding-command'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getCommandBucket(report, key) {
    const commands = report && report.commands ? report.commands : {};
    return normalizeArray(commands[key]);
  }

  function collectIssues(report) {
    if (!report) return [];
    return [
      ...normalizeArray(report.deadRouteReferences).map((item) => ({ ...item, issueType: ISSUE_TYPES.deadRouteReferences })),
      ...normalizeArray(report.orphanRoutes).map((item) => ({ ...item, issueType: ISSUE_TYPES.orphanRoutes })),
      ...normalizeArray(report.placeholderControls).map((item) => ({ ...item, issueType: ISSUE_TYPES.placeholderControls })),
      ...getCommandBucket(report, 'deadExecuted').map((item) => ({ ...item, issueType: ISSUE_TYPES.deadExecutedCommands })),
      ...getCommandBucket(report, 'unregisteredContributed').map((item) => ({ ...item, issueType: ISSUE_TYPES.unregisteredContributedCommands })),
      ...getCommandBucket(report, 'deadMenuCommands').map((item) => ({ ...item, issueType: ISSUE_TYPES.deadMenuCommands })),
      ...getCommandBucket(report, 'deadKeybindingCommands').map((item) => ({ ...item, issueType: ISSUE_TYPES.deadKeybindingCommands }))
    ];
  }

  function issueKey(issue) {
    return [
      issue.issueType || '',
      issue.command || '',
      issue.path || '',
      issue.file || '',
      issue.line || '',
      issue.kind || '',
      issue.rawValue || ''
    ].join('::');
  }

  function bucketSummary(issues) {
    const buckets = {
      deadRouteReferences: 0,
      orphanRoutes: 0,
      placeholderControls: 0,
      deadExecutedCommands: 0,
      unregisteredContributedCommands: 0,
      deadMenuCommands: 0,
      deadKeybindingCommands: 0
    };
    for (const issue of issues) {
      switch (issue.issueType) {
        case ISSUE_TYPES.deadRouteReferences:
          buckets.deadRouteReferences += 1; break;
        case ISSUE_TYPES.orphanRoutes:
          buckets.orphanRoutes += 1; break;
        case ISSUE_TYPES.placeholderControls:
          buckets.placeholderControls += 1; break;
        case ISSUE_TYPES.deadExecutedCommands:
          buckets.deadExecutedCommands += 1; break;
        case ISSUE_TYPES.unregisteredContributedCommands:
          buckets.unregisteredContributedCommands += 1; break;
        case ISSUE_TYPES.deadMenuCommands:
          buckets.deadMenuCommands += 1; break;
        case ISSUE_TYPES.deadKeybindingCommands:
          buckets.deadKeybindingCommands += 1; break;
        default:
          break;
      }
    }
    return buckets;
  }

  function compareReports(baselineReport, candidateReport) {
    const baselineIssues = collectIssues(baselineReport);
    const candidateIssues = collectIssues(candidateReport);
    const baselineKeys = new Map(baselineIssues.map((issue) => [issueKey(issue), issue]));
    const candidateKeys = new Map(candidateIssues.map((issue) => [issueKey(issue), issue]));

    const added = [];
    const resolved = [];

    for (const [key, issue] of candidateKeys.entries()) {
      if (!baselineKeys.has(key)) added.push(issue);
    }
    for (const [key, issue] of baselineKeys.entries()) {
      if (!candidateKeys.has(key)) resolved.push(issue);
    }

    const baselineSummary = baselineReport && baselineReport.summary ? clone(baselineReport.summary) : {};
    const candidateSummary = candidateReport && candidateReport.summary ? clone(candidateReport.summary) : {};

    return {
      generatedAt: new Date().toISOString(),
      baselineWorkspace: baselineReport ? baselineReport.workspaceName : '',
      candidateWorkspace: candidateReport ? candidateReport.workspaceName : '',
      baselineSummary,
      candidateSummary,
      baselineIssueCount: baselineIssues.length,
      candidateIssueCount: candidateIssues.length,
      addedIssueCount: added.length,
      resolvedIssueCount: resolved.length,
      regressionSummary: {
        added: bucketSummary(added),
        resolved: bucketSummary(resolved)
      },
      addedIssues: added.sort(sortIssues),
      resolvedIssues: resolved.sort(sortIssues)
    };
  }

  function sortIssues(a, b) {
    return issueKey(a).localeCompare(issueKey(b));
  }

  function issueTitle(issue) {
    switch (issue.issueType) {
      case ISSUE_TYPES.deadRouteReferences: return 'Dead route reference';
      case ISSUE_TYPES.orphanRoutes: return 'Orphan route';
      case ISSUE_TYPES.placeholderControls: return 'Placeholder control';
      case ISSUE_TYPES.deadExecutedCommands: return 'Dead executed command';
      case ISSUE_TYPES.unregisteredContributedCommands: return 'Unregistered contributed command';
      case ISSUE_TYPES.deadMenuCommands: return 'Dead menu command';
      case ISSUE_TYPES.deadKeybindingCommands: return 'Dead keybinding command';
      default: return 'Issue';
    }
  }

  function issueLocation(issue) {
    const line = issue.line || 1;
    return `${issue.file || 'unknown'}:${line}`;
  }

  function issuePrimary(issue) {
    return issue.path || issue.command || issue.rawValue || issue.kind || 'issue';
  }

  function renderReportMarkdown(report) {
    const commandIssueCount = (report.summary.unregisteredContributedCommands || 0)
      + (report.summary.deadExecutedCommands || 0)
      + (report.summary.deadMenuCommands || 0)
      + (report.summary.deadKeybindingCommands || 0);
    const lines = [
      '# Dead Route Detector Report',
      '',
      `- Workspace: ${report.workspaceName}`,
      `- Generated: ${report.generatedAt}`,
      `- Files scanned: ${report.summary.filesScanned}`,
      `- Dead route references: ${report.summary.deadRouteReferences}`,
      `- Orphan routes: ${report.summary.orphanRoutes}`,
      `- Dead command findings: ${commandIssueCount}`,
      `- Placeholder controls: ${report.summary.placeholderControls}`,
      ''
    ];

    for (const section of [
      ['Dead route references', normalizeArray(report.deadRouteReferences)],
      ['Orphan routes', normalizeArray(report.orphanRoutes)],
      ['Placeholder controls', normalizeArray(report.placeholderControls)],
      ['Dead executed commands', getCommandBucket(report, 'deadExecuted')],
      ['Unregistered contributed commands', getCommandBucket(report, 'unregisteredContributed')],
      ['Dead menu commands', getCommandBucket(report, 'deadMenuCommands')],
      ['Dead keybinding commands', getCommandBucket(report, 'deadKeybindingCommands')]
    ]) {
      lines.push(`## ${section[0]}`);
      if (!section[1].length) {
        lines.push('', 'No findings.', '');
        continue;
      }
      lines.push('');
      for (const issue of section[1]) {
        lines.push(`- ${issuePrimary(issue)} · ${issueLocation(issue)}${issue.kind ? ` · ${issue.kind}` : ''}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  function renderDiffMarkdown(diff) {
    const lines = [
      '# Dead Route Detector Regression Diff',
      '',
      `- Baseline workspace: ${diff.baselineWorkspace || 'baseline'}`,
      `- Candidate workspace: ${diff.candidateWorkspace || 'candidate'}`,
      `- Generated: ${diff.generatedAt}`,
      `- Added issues: ${diff.addedIssueCount}`,
      `- Resolved issues: ${diff.resolvedIssueCount}`,
      ''
    ];
    for (const [title, items] of [
      ['Added issues', normalizeArray(diff.addedIssues)],
      ['Resolved issues', normalizeArray(diff.resolvedIssues)]
    ]) {
      lines.push(`## ${title}`);
      if (!items.length) {
        lines.push('', 'None.', '');
        continue;
      }
      lines.push('');
      for (const issue of items) {
        lines.push(`- ${issueTitle(issue)} · ${issuePrimary(issue)} · ${issueLocation(issue)}${issue.kind ? ` · ${issue.kind}` : ''}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }


  function renderPullRequestComment(diff, context = {}) {
    const ownerRepo = context.owner && context.repo ? `${context.owner}/${context.repo}` : (context.repository || 'repository');
    const pullLabel = context.pull || context.pullNumber || context.pullRequest || 'pull request';
    const lines = [
      `## Dead Route Detector regression review · ${ownerRepo} ${pullLabel}`,
      '',
      `- Baseline workspace: ${diff.baselineWorkspace || 'baseline'}`,
      `- Candidate workspace: ${diff.candidateWorkspace || 'candidate'}`,
      `- Added issues: ${diff.addedIssueCount}`,
      `- Resolved issues: ${diff.resolvedIssueCount}`,
      ''
    ];

    if (diff.addedIssueCount) {
      lines.push('### Added issues', '');
      for (const issue of normalizeArray(diff.addedIssues).slice(0, 50)) {
        lines.push(`- ${issueTitle(issue)} · ${issuePrimary(issue)} · ${issueLocation(issue)}${issue.kind ? ` · ${issue.kind}` : ''}`);
      }
      lines.push('');
    } else {
      lines.push('### Added issues', '', 'None.', '');
    }

    if (diff.resolvedIssueCount) {
      lines.push('### Resolved issues', '');
      for (const issue of normalizeArray(diff.resolvedIssues).slice(0, 50)) {
        lines.push(`- ${issueTitle(issue)} · ${issuePrimary(issue)} · ${issueLocation(issue)}${issue.kind ? ` · ${issue.kind}` : ''}`);
      }
      lines.push('');
    }

    lines.push('### Regression summary', '');
    lines.push(`- Added dead route references: ${diff.regressionSummary.added.deadRouteReferences}`);
    lines.push(`- Added placeholder controls: ${diff.regressionSummary.added.placeholderControls}`);
    lines.push(`- Added dead command findings: ${diff.regressionSummary.added.deadExecutedCommands + diff.regressionSummary.added.unregisteredContributedCommands + diff.regressionSummary.added.deadMenuCommands + diff.regressionSummary.added.deadKeybindingCommands}`);
    lines.push('');
    return lines.join('\n');
  }

  function toSarif(report) {
    const issues = collectIssues(report);
    return {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Dead Route Detector - SkyeVSX',
              informationUri: 'https://skyesol.netlify.app/',
              rules: Array.from(new Set(issues.map((issue) => issue.issueType))).map((ruleId) => ({
                id: ruleId,
                name: ruleId,
                shortDescription: { text: ruleId.replace(/-/g, ' ') }
              }))
            }
          },
          results: issues.map((issue) => ({
            ruleId: issue.issueType,
            level: 'warning',
            message: {
              text: `${issueTitle(issue)}: ${issuePrimary(issue)}`
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: issue.file || '' },
                  region: { startLine: issue.line || 1 }
                }
              }
            ]
          }))
        }
      ]
    };
  }

  return {
    ISSUE_TYPES,
    collectIssues,
    compareReports,
    renderDiffMarkdown,
    renderPullRequestComment,
    renderReportMarkdown,
    toSarif
  };
}));
