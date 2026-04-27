import fs from 'node:fs';
import path from 'node:path';

const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json', '.py', '.html']);
const DEFAULT_CONFIG = {
  ignoreSegments: [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    '.media-center-storage', '.ae-runtime', 'snapshots', 'proof', 'generated-projects'
  ],
  ignorePathPrefixes: ['workspace/volumes', 'dist/production-release', 'dist/ship-candidate'],
  jsxExtensions: ['.jsx', '.tsx'],
  severityByType: {
    duplicate_import: 'medium',
    duplicate_object_key: 'high',
    repeated_config_key: 'medium',
    broken_jsx_structure: 'critical',
    repeated_chunk: 'low',
    stub_body: 'critical',
    todo_fixme: 'high',
    fake_success_return: 'critical',
    mock_integration: 'critical',
    hardcoded_mock_data: 'high',
    empty_handler: 'critical',
  },
  ownershipRules: {
    'platform/user-platforms/': 'ae-platform-team',
    'platform/ide-core/': 'ide-core-team',
    'apps/': 'runtime-team'
  },
  repeatedChunkOptions: {
    windowSize: 5,
    minLineLength: 20,
    maxIssuesPerFile: 5,
    minSemanticLines: 3
  }
};

function readString(value) {
  return String(value ?? '').trim();
}

export function loadGrayChunksConfig(rootDir) {
  const configPath = path.join(rootDir, 'graychunks.config.json');
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, configPath: null };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      configPath,
      ignoreSegments: Array.isArray(parsed.ignoreSegments) && parsed.ignoreSegments.length ? parsed.ignoreSegments : DEFAULT_CONFIG.ignoreSegments,
      ignorePathPrefixes: Array.isArray(parsed.ignorePathPrefixes) ? parsed.ignorePathPrefixes : DEFAULT_CONFIG.ignorePathPrefixes,
      jsxExtensions: Array.isArray(parsed.jsxExtensions) && parsed.jsxExtensions.length ? parsed.jsxExtensions : DEFAULT_CONFIG.jsxExtensions,
      severityByType: { ...DEFAULT_CONFIG.severityByType, ...(parsed.severityByType || {}) },
      ownershipRules: { ...DEFAULT_CONFIG.ownershipRules, ...(parsed.ownershipRules || {}) },
      repeatedChunkOptions: { ...DEFAULT_CONFIG.repeatedChunkOptions, ...(parsed.repeatedChunkOptions || {}) }
    };
  } catch {
    return { ...DEFAULT_CONFIG, configPath };
  }
}

function shouldSkipPath(relativePath, ignoreSegments, ignorePathPrefixes) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (ignorePathPrefixes.some((prefix) => normalized.startsWith(prefix.replace(/\\/g, '/')))) return true;
  const parts = normalized.split('/');
  return parts.some((part) => ignoreSegments.includes(part));
}

function listFiles(rootDir, config) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const relative = path.relative(rootDir, current) || '';
    if (relative && shouldSkipPath(relative, config.ignoreSegments, config.ignorePathPrefixes || [])) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        stack.push(path.join(current, entry.name));
      }
      continue;
    }
    if (!CODE_EXTENSIONS.has(path.extname(current))) continue;
    out.push(current);
  }
  return out;
}

function detectDuplicateImports(lines, relativePath) {
  const issues = [];
  const seenImports = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const line = readString(lines[index]);
    if (!line.startsWith('import ')) continue;
    const normalized = line.replace(/\s+/g, ' ');
    if (seenImports.has(normalized)) {
      issues.push({ type: 'duplicate_import', file: relativePath, line: index + 1, message: `Duplicate import statement repeated from line ${seenImports.get(normalized)}.` });
    } else {
      seenImports.set(normalized, index + 1);
    }
  }
  return issues;
}

function detectDuplicateObjectKeys(lines, relativePath) {
  const issues = [];
  const keyRegex = /^\s*([A-Za-z_$][\w$-]*)\s*:/;
  const keyStack = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opens = (line.match(/\{/g) || []).length;
    for (let n = 0; n < opens; n += 1) keyStack.push(new Map());

    const match = line.match(keyRegex);
    if (match && keyStack.length) {
      const key = match[1];
      const keys = keyStack[keyStack.length - 1];
      if (keys.has(key)) {
        issues.push({ type: 'duplicate_object_key', file: relativePath, line: index + 1, message: `Object key '${key}' repeats key first seen on line ${keys.get(key)}.` });
      } else {
        keys.set(key, index + 1);
      }
    }

    const closes = (line.match(/\}/g) || []).length;
    for (let n = 0; n < closes; n += 1) keyStack.pop();
  }

  return issues;
}

function detectBrokenJsx(lines, relativePath, jsxExtensions) {
  const ext = path.extname(relativePath).toLowerCase();
  if (!jsxExtensions.includes(ext)) return [];

  const joined = lines.join('\n');
  const issues = [];
  const openTags = [...joined.matchAll(/<([A-Z][A-Za-z0-9]{2,})\b(?![^>]*\/>)((?:(?!=>)[^\n])*?)>/g)].map((m) => m[1]);
  const closeTags = [...joined.matchAll(/<\/([A-Z][A-Za-z0-9]{2,})>/g)].map((m) => m[1]);

  const openCount = new Map();
  const closeCount = new Map();
  for (const tag of openTags) openCount.set(tag, (openCount.get(tag) || 0) + 1);
  for (const tag of closeTags) closeCount.set(tag, (closeCount.get(tag) || 0) + 1);

  for (const [tag, count] of openCount.entries()) {
    if ((closeCount.get(tag) || 0) !== count) {
      issues.push({ type: 'broken_jsx_structure', file: relativePath, line: 1, message: `JSX tag '${tag}' has ${count} openings but ${closeCount.get(tag) || 0} closings.` });
    }
  }

  return issues;
}

function detectRepeatedConfigKeys(lines, relativePath) {
  if (path.extname(relativePath).toLowerCase() !== '.json') return [];
  const keyRegex = /^\s*"([^"\\]+)"\s*:/;
  // Stack tracks: { keys: Map, inArray: boolean } — objects inside arrays share no key scope
  const stack = [];
  const arrayDepth = []; // parallel stack: true if this level is inside a [ ... ]
  const issues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Track array opens/closes to know when an object is an array element
    for (const ch of line) {
      if (ch === '[') arrayDepth.push(true);
      else if (ch === ']') arrayDepth.pop();
      else if (ch === '{') stack.push({ keys: new Map(), isArrayElement: arrayDepth.length > 0 && arrayDepth[arrayDepth.length - 1] });
      else if (ch === '}') stack.pop();
    }

    const match = line.match(keyRegex);
    if (match && stack.length) {
      const frame = stack[stack.length - 1];
      // Don't flag repeated keys in objects that are array elements — sibling objects legitimately share key names
      if (frame.isArrayElement) continue;
      const key = match[1];
      if (frame.keys.has(key)) {
        issues.push({ type: 'repeated_config_key', file: relativePath, line: index + 1, message: `JSON key '${key}' duplicated within same object (first seen line ${frame.keys.get(key)}).` });
      } else {
        frame.keys.set(key, index + 1);
      }
    }
  }

  return issues;
}

function detectRepeatedChunks(lines, relativePath, options = DEFAULT_CONFIG.repeatedChunkOptions) {
  const windowSize = Math.max(3, Number.parseInt(options.windowSize || DEFAULT_CONFIG.repeatedChunkOptions.windowSize, 10));
  const minLineLength = Math.max(10, Number.parseInt(options.minLineLength || DEFAULT_CONFIG.repeatedChunkOptions.minLineLength, 10));
  const maxIssuesPerFile = Math.max(1, Number.parseInt(options.maxIssuesPerFile || DEFAULT_CONFIG.repeatedChunkOptions.maxIssuesPerFile, 10));
  const minSemanticLines = Math.max(2, Number.parseInt(options.minSemanticLines || DEFAULT_CONFIG.repeatedChunkOptions.minSemanticLines, 10));
  const issues = [];
  const seen = new Map();

  for (let index = 0; index <= lines.length - windowSize; index += 1) {
    const block = lines.slice(index, index + windowSize).map((line) => readString(line));
    if (block.some((line) => !line || line.startsWith('//') || line.length < minLineLength)) continue;
    if (block.some((line) => /^[{}()[\];,]+$/.test(line.replace(/\s+/g, '')))) continue;
    if (block.some((line) => /^(import|export|function|if|for|while|switch|catch)\b/.test(line))) continue;
    if (block.filter((line) => /(=|return\b|await\b|\.[A-Za-z_$][\w$]*\(|\bnew\b)/.test(line)).length < minSemanticLines) continue;
    if (new Set(block).size !== block.length) continue;
    const key = block.join('\n');
    if (seen.has(key)) {
      const originalLine = seen.get(key);
      if ((index + 1) - originalLine < windowSize) continue;
      issues.push({
        type: 'repeated_chunk',
        file: relativePath,
        line: index + 1,
        message: `Repeated ${windowSize}-line chunk first seen on line ${originalLine}.`
      });
      if (issues.length >= maxIssuesPerFile) break;
      continue;
    }
    seen.set(key, index + 1);
  }

  return issues;
}

// ─── Stub / completeness detection ─────────────────────────────────────────

// Patterns that indicate a function body is a stub in JS/TS
const JS_STUB_BODY_RE = [
  /^\s*(\/\/\s*(TODO|FIXME|STUB|PLACEHOLDER|IMPLEMENT|COMING SOON|NOT IMPLEMENTED))/i,
  /^\s*\/\*\s*(TODO|FIXME|STUB|NOT IMPLEMENTED)/i,
  /^\s*throw\s+new\s+(Error|NotImplementedError)\(['"`]?(not implemented|todo|stub|placeholder)/i,
  /^\s*console\.(log|warn|error)\(['"`](stub|todo|fixme|placeholder|not implemented)/i,
];

// Python stub patterns
const PY_STUB_BODY_RE = [
  /^\s*pass\s*$/,
  /^\s*raise\s+NotImplementedError/,
  /^\s*#\s*(TODO|FIXME|STUB|PLACEHOLDER|NOT IMPLEMENTED)/i,
  /^\s*\.\.\.\s*$/,  // ellipsis as stub
];

// Provider names that must have real API calls
const PROVIDER_NAMES = ['printful', 'stripe', 'paypal', 'calendly', 'google', 'microsoft', 'openai', 'anthropic', 'gemini', 'resend', 'twilio', 'sendgrid'];
// Recognizes real API dispatch: external HTTP, SDK constructors, known clients, spawn, fs writes, require-based calls, TS DI patterns
const REAL_DISPATCH_RE = /fetch\s*\(|axios\s*\.|\.post\s*\(|\.get\s*\(|new\s+\w*Client\b|new\s+(OpenAI|Anthropic|Stripe|Resend|Twilio|Calendly|SendGrid)\s*\(|sdk\.|api\.|createClient|anthropic\.|openai\.|spawnSync\s*\(|spawn\s*\(|execSync\s*\(|exec\s*\(|writeFileSync\s*\(|writeFile\s*\(|require\s*\(|db\.|pool\.|\.query\s*\(|\.run\s*\(|writeSnapshot\s*\(|appendAuditEvent\s*\(|writeUsageEvent\s*\(|localStorage\.|@injectable\(|@inject\(|throw\s+new\s+|throw\s+Object\.assign\s*\(|this\.\w+Service\.|this\.\w+Manager\.|this\.\w+Client\./;

function detectStubBodies(lines, relativePath) {
  const issues = [];
  const ext = path.extname(relativePath).toLowerCase();
  const isPy = ext === '.py';
  const isJs = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext);
  if (!isPy && !isJs) return issues;

  const stubPatterns = isPy ? PY_STUB_BODY_RE : JS_STUB_BODY_RE;
  let inFunctionDepth = 0;
  let functionStartLine = -1;
  let bodyLineCount = 0;
  let stubLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track function entry
    if (isJs && /^(export\s+)?(async\s+)?function\s+\w+|^\s*(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(line)) {
      if (inFunctionDepth === 0) { functionStartLine = i + 1; bodyLineCount = 0; stubLineCount = 0; }
    }
    if (isPy && /^(async\s+)?def\s+\w+/.test(trimmed)) {
      functionStartLine = i + 1; bodyLineCount = 0; stubLineCount = 0;
    }

    if (functionStartLine > 0) {
      bodyLineCount++;
      for (const re of stubPatterns) {
        if (re.test(line)) { stubLineCount++; break; }
      }
      // If the first 1-5 non-empty body lines are all stubs, flag it
      if (bodyLineCount >= 1 && bodyLineCount <= 5 && stubLineCount === bodyLineCount && trimmed.length > 0) {
        issues.push({ type: 'stub_body', file: relativePath, line: functionStartLine, message: `Function at line ${functionStartLine} appears to be a stub (body is placeholder/pass/not-implemented).` });
        functionStartLine = -1; // avoid duplicate flag for same function
      }
    }
  }
  return issues;
}

function detectTodoFixme(lines, relativePath) {
  const issues = [];
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === '.json') return issues;
  const re = /\b(TODO|FIXME|HACK|XXX|STUB|NOT IMPLEMENTED|COMING SOON|PLACEHOLDER)\b/i;
  const isHtml = ext === '.html';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!re.test(line)) continue;
    const trimmed = line.trim();

    // HTML: skip placeholder="" attributes — these are valid HTML, not code stubs
    if (isHtml && /placeholder\s*=\s*["'][^"']*["']/i.test(line) && !/<!--.*\b(TODO|FIXME|STUB)\b/.test(line)) continue;
    // HTML: only flag inside <!-- comments --> or <script> context
    if (isHtml) {
      const isHtmlComment = /<!--.*\b(TODO|FIXME|HACK|STUB|NOT IMPLEMENTED)\b/i.test(line);
      if (!isHtmlComment) continue;
    }

    // Skip if the match is inside a regex literal or string pattern definition
    if (/^(const|let|var)\s+\w+(RE|_RE|Re|Regex|Regexp|Pattern)\s*=/.test(trimmed)) continue;
    if (/^\/[\w|()[\]\\^$.*+?{}]+\/[gimsuy]*/.test(trimmed)) continue;
    if (/\/[^/]*\b(TODO|FIXME|STUB|PLACEHOLDER|NOT IMPLEMENTED)\b[^/]*\//.test(line)) continue;

    // Skip XXX in URL/hostname patterns like ep-xxx.region.aws.neon.tech
    if (/\b(xxx|XXX)\b/.test(line) && /[-.]xxx[-.]|ep-xxx|_xxx_|\/xxx\//i.test(line)) continue;

    // Only flag if it looks like a developer comment or string note
    const isComment = /^\s*(\/\/|#|\*|\/\*)/.test(trimmed);
    const isInlineComment = /\/\/.*\b(TODO|FIXME|HACK|XXX|STUB|NOT IMPLEMENTED)\b/i.test(line);
    const isStringNote = /['"`]\s*(TODO|FIXME|STUB|NOT IMPLEMENTED|PLACEHOLDER)/i.test(line) && !/fetch\(|dispatch\(|test\(|describe\(|expect\(/.test(line);
    if (isComment || isInlineComment || isStringNote) {
      const match = line.match(re);
      issues.push({ type: 'todo_fixme', file: relativePath, line: i + 1, message: `${match[0]} marker found — incomplete implementation.` });
    }
  }
  return issues;
}

function detectFakeSuccess(lines, relativePath) {
  const issues = [];
  const ext = path.extname(relativePath).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) return issues;

  const fakeSuccessRe = /return\s+\{[^}]*\b(success\s*:\s*true|status\s*:\s*['"]ok['"]|message\s*:\s*['"]success['"]|ok\s*:\s*true)[^}]*\}|res\.json\s*\(\s*\{[^}]*\b(success|status|ok)\s*:/i;
  const content = lines.join('\n');

  if (fakeSuccessRe.test(content) && !REAL_DISPATCH_RE.test(content)) {
    issues.push({ type: 'fake_success_return', file: relativePath, line: 1, message: 'Returns success/ok without any real fetch/SDK dispatch — likely a stub returning hardcoded response.' });
  }
  return issues;
}

function detectMockIntegrations(lines, relativePath) {
  const issues = [];
  const name = path.basename(relativePath).toLowerCase();
  const ext = path.extname(relativePath).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py'].includes(ext)) return issues;

  const isProviderFile = PROVIDER_NAMES.some(p => name.includes(p));
  if (!isProviderFile) return issues;

  // Intentional local/mock/config files are exempt — they're development helpers, not integration stubs
  if (/-local-runtime|\.example\.|config\.example|-mock\.|\.mock\.|-config\.|edm-config|embed-config|frontend-module/i.test(name)) return issues;
  // TypeScript interface/type-only files (no class body, only interface/type/Symbol definitions)
  if (ext === '.ts' && !/class\s+\w+/.test(lines.join('\n'))) return issues;

  const content = lines.join('\n');
  // If the file imports the provider SDK or has real dispatch, it's not a mock
  if (REAL_DISPATCH_RE.test(content)) return issues;
  // Also skip if the file imports from the provider package (e.g. import OpenAI from 'openai')
  const provider = PROVIDER_NAMES.find(p => name.includes(p));
  if (new RegExp(`import[^'"]+from\\s+['"]${provider}`, 'i').test(content)) return issues;
  if (new RegExp(`require\\s*\\(\\s*['"]${provider}`, 'i').test(content)) return issues;

  issues.push({ type: 'mock_integration', file: relativePath, line: 1, message: `File named for '${provider}' but contains no real API dispatch (fetch/axios/sdk). Integration is likely mocked.` });
  return issues;
}

function detectHardcodedMockData(lines, relativePath) {
  const issues = [];
  const ext = path.extname(relativePath).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) return issues;

  const mockDataRe = /\b(mock|fake|dummy|fixture|sample|placeholder)\s*(data|products?|orders?|users?|response|result|state)\s*=/ig;
  const content = lines.join('\n');
  const matches = [...content.matchAll(mockDataRe)];
  for (const m of matches) {
    const lineNum = content.slice(0, m.index).split('\n').length;
    issues.push({ type: 'hardcoded_mock_data', file: relativePath, line: lineNum, message: `Hardcoded mock/fake data '${m[0].trim()}' — real data source required for production claims.` });
  }
  return issues;
}

function detectEmptyHandlers(lines, relativePath) {
  const issues = [];
  const ext = path.extname(relativePath).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) return issues;

  const content = lines.join('\n');
  // Route handler that immediately returns empty/trivial response
  const emptyHandlerRe = /exports\.\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[^}]{0,120}\b(statusCode|status)\s*:\s*200[^}]{0,80}\}/;
  const trivialBodyRe = /handler\s*=\s*async[^{]*\{[\s\n]*(\/\/[^\n]*\n)?[\s\n]*return\s*\{[^}]{0,100}\}[\s\n]*\}/;
  if ((emptyHandlerRe.test(content) || trivialBodyRe.test(content)) && !REAL_DISPATCH_RE.test(content)) {
    issues.push({ type: 'empty_handler', file: relativePath, line: 1, message: 'Route handler returns trivial response with no real logic (no DB, fetch, or SDK calls).' });
  }
  return issues;
}

export function scanGrayChunks({ rootDir, targetDir = rootDir, config = loadGrayChunksConfig(rootDir) } = {}) {
  const files = listFiles(targetDir, config);
  const issues = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');

    issues.push(...detectDuplicateImports(lines, relative));
    issues.push(...detectDuplicateObjectKeys(lines, relative));
    issues.push(...detectBrokenJsx(lines, relative, config.jsxExtensions || DEFAULT_CONFIG.jsxExtensions));
    issues.push(...detectRepeatedConfigKeys(lines, relative));
    issues.push(...detectRepeatedChunks(lines, relative, config.repeatedChunkOptions || DEFAULT_CONFIG.repeatedChunkOptions));
    // Completeness / stub detection
    issues.push(...detectStubBodies(lines, relative));
    issues.push(...detectTodoFixme(lines, relative));
    issues.push(...detectFakeSuccess(lines, relative));
    issues.push(...detectMockIntegrations(lines, relative));
    issues.push(...detectHardcodedMockData(lines, relative));
    issues.push(...detectEmptyHandlers(lines, relative));
  }

  const byType = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    configPath: config.configPath ? path.relative(rootDir, config.configPath).replace(/\\/g, '/') : null,
    scannedFiles: files.length,
    issueCount: issues.length,
    issuesByType: byType,
    issues
  };
}

export function writeGrayChunkReports({ rootDir, report }) {
  const outDir = path.join(rootDir, 'skydexia', 'alerts');
  const jsonPath = path.join(outDir, 'graychunks-findings.json');
  const mdPath = path.join(rootDir, 'GRAYCHUNKS_REPORT.md');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const CRITICAL_TYPES = new Set(['stub_body', 'fake_success_return', 'mock_integration', 'empty_handler', 'broken_jsx_structure']);
  const HIGH_TYPES = new Set(['todo_fixme', 'hardcoded_mock_data', 'duplicate_object_key']);
  const criticalIssues = report.issues.filter(i => CRITICAL_TYPES.has(i.type));
  const highIssues = report.issues.filter(i => HIGH_TYPES.has(i.type));
  const completenessTypes = ['stub_body', 'todo_fixme', 'fake_success_return', 'mock_integration', 'hardcoded_mock_data', 'empty_handler'];
  const completenessIssues = report.issues.filter(i => completenessTypes.includes(i.type));

  const lines = [
    '# GrayChunks Scan Report',
    '',
    `GeneratedAt: ${report.generatedAt}`,
    `ConfigPath: ${report.configPath || 'default'}`,
    `Scanned files: ${report.scannedFiles}`,
    `Issue count: ${report.issueCount}`,
    `Critical: ${criticalIssues.length} | High: ${highIssues.length}`,
    `Completeness violations: ${completenessIssues.length}`,
    '',
    '## Completeness Violations (Stubs / Fake Implementations)',
    ...completenessIssues.slice(0, 30).map((issue) => `- [${issue.type.toUpperCase()}] ${issue.file}:${issue.line} — ${issue.message}`),
    completenessIssues.length === 0 ? '_None detected._' : '',
    '',
    '## All Issue Types',
    ...Object.entries(report.issuesByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `- ${type}: ${count}`),
    '',
    '## All Findings',
    ...report.issues.slice(0, 100).map((issue) => `- ${issue.type} | ${issue.file}:${issue.line} | ${issue.message}`)
  ];

  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
  return { jsonPath, mdPath };
}

export function makeRelative(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).replace(/\\/g, '/');
}

export function resolveSafeTargetDir(rootDir, targetValue, { enforceWithinRoot = true } = {}) {
  const value = readString(targetValue);
  if (!value) return rootDir;
  const resolved = path.resolve(rootDir, value);
  if (!enforceWithinRoot) return resolved;
  const relative = path.relative(rootDir, resolved);
  if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new Error(`Target directory must remain within repository root: ${value}`);
  }
  return resolved;
}

export function resolveOwner(filePath, ownershipRules = DEFAULT_CONFIG.ownershipRules) {
  const entries = Object.entries(ownershipRules || {});
  for (const [prefix, owner] of entries) {
    if (filePath.startsWith(prefix)) return owner;
  }
  return 'core-platform-team';
}
