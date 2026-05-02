(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DeadRouteScanner = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TEXT_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.html', '.htm', '.vue', '.svelte', '.astro', '.md', '.txt'
  ]);

  const DEFAULT_EXCLUDES = [
    'node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.vercel', '.cache', 'coverage', 'out'
  ];

  function toPosix(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function stripQueryAndHash(value) {
    return String(value).split('#')[0].split('?')[0].trim();
  }

  function isExternalLike(value) {
    return /^(https?:|mailto:|tel:|data:)/i.test(value);
  }

  function splitSegments(value) {
    return toPosix(value).split('/').filter(Boolean);
  }

  function posixBasename(value) {
    const segments = splitSegments(value);
    return segments.length ? segments[segments.length - 1] : '';
  }

  function posixDirname(value) {
    const posix = toPosix(value);
    const segments = splitSegments(posix);
    if (!segments.length) return '.';
    segments.pop();
    return segments.length ? segments.join('/') : '.';
  }

  function posixExtname(value) {
    const base = posixBasename(value);
    const index = base.lastIndexOf('.');
    if (index <= 0) return '';
    return base.slice(index).toLowerCase();
  }

  function posixNormalize(value) {
    const raw = toPosix(value || '');
    const isAbsolute = raw.startsWith('/');
    const input = raw.split('/');
    const stack = [];
    for (const part of input) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (stack.length && stack[stack.length - 1] !== '..') {
          stack.pop();
        } else if (!isAbsolute) {
          stack.push('..');
        }
        continue;
      }
      stack.push(part);
    }
    const joined = stack.join('/');
    if (isAbsolute) {
      return joined ? `/${joined}` : '/';
    }
    return joined || '.';
  }

  function posixJoin() {
    return posixNormalize(Array.from(arguments).filter(Boolean).join('/'));
  }

  function normalizeLocalPath(value) {
    if (!value) return null;
    let candidate = String(value).trim();
    if (!candidate) return null;
    if (isExternalLike(candidate)) return null;
    if (candidate === '#' || /^javascript:/i.test(candidate)) return null;
    candidate = stripQueryAndHash(candidate);
    if (!candidate) return null;
    if (!candidate.startsWith('/')) {
      if (candidate.startsWith('./')) candidate = candidate.slice(1);
      if (candidate.startsWith('../')) return candidate;
      candidate = `/${candidate}`;
    }
    candidate = candidate.replace(/\/+/, '/');
    candidate = candidate.replace(/\/+/g, '/');
    if (candidate.length > 1 && candidate.endsWith('/')) candidate = candidate.slice(0, -1);
    return candidate || '/';
  }

  function normalizeReferencePath(value, relPath, kind) {
    if (!value) return null;
    let candidate = String(value).trim();
    if (!candidate) return null;
    if (isExternalLike(candidate)) return null;
    if (candidate === '#' || /^javascript:/i.test(candidate)) return null;
    candidate = stripQueryAndHash(candidate);
    if (!candidate) return null;

    if (candidate.startsWith('/')) {
      return normalizeLocalPath(candidate);
    }

    const posixRel = toPosix(relPath);
    const sourceExt = posixExtname(posixRel);
    const sourceDir = posixDirname(posixRel);
    const isHtmlSource = sourceExt === '.html' || sourceExt === '.htm';
    const looksLikeFileReference = /\.[A-Za-z0-9]+$/.test(candidate);
    const shouldResolveRelative = candidate.startsWith('./')
      || candidate.startsWith('../')
      || (isHtmlSource && (looksLikeFileReference || kind === 'href'));

    if (shouldResolveRelative) {
      const baseDir = sourceDir === '.' ? '/' : `/${sourceDir}`;
      const resolved = posixNormalize(posixJoin(baseDir, candidate));
      return normalizeLocalPath(resolved);
    }

    return normalizeLocalPath(candidate);
  }

  function lineNumberAt(text, index) {
    return String(text).slice(0, index).split('\n').length;
  }

  function dedupeIssues(items, keyBuilder) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyBuilder(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pathFromPagesFile(relPath) {
    const posix = toPosix(relPath);
    const pageRoots = ['pages/', 'src/pages/'];
    for (const root of pageRoots) {
      const idx = posix.indexOf(root);
      if (idx === -1) continue;
      let rest = posix.slice(idx + root.length);
      if (rest.startsWith('api/')) return null;
      if (/^_(app|document|error)\./.test(rest)) return null;
      rest = rest.replace(/\.(jsx?|tsx?|mdx|astro|vue|svelte)$/i, '');
      rest = rest.replace(/\/index$/i, '');
      rest = rest.replace(/\[(\.\.\.)?([^\]]+)\]/g, function (_, spread, name) {
        return spread ? `:${name}*` : `:${name}`;
      });
      return normalizeLocalPath(rest || '/');
    }
    return null;
  }

  function pathFromAppDirFile(relPath) {
    const posix = toPosix(relPath);
    const appRoots = ['app/', 'src/app/'];
    for (const root of appRoots) {
      const idx = posix.indexOf(root);
      if (idx === -1) continue;
      const rest = posix.slice(idx + root.length);
      if (!/\/page\.(jsx?|tsx?|mdx)$/i.test(`/${rest}`) && !/^page\.(jsx?|tsx?|mdx)$/i.test(rest)) continue;
      let routePart = rest.replace(/\/page\.(jsx?|tsx?|mdx)$/i, '').replace(/^page\.(jsx?|tsx?|mdx)$/i, '');
      routePart = routePart.replace(/\[(\.\.\.)?([^\]]+)\]/g, function (_, spread, name) {
        return spread ? `:${name}*` : `:${name}`;
      });
      return normalizeLocalPath(routePart || '/');
    }
    return null;
  }

  function pathFromSvelteOrAstro(relPath) {
    const posix = toPosix(relPath);
    const patterns = [
      { prefix: 'src/routes/', routeRegex: /\/\+page\.(js|ts|svelte|md)$/i },
      { prefix: 'src/pages/', routeRegex: /\.(astro|md|mdx|html|js|ts|jsx|tsx|vue|svelte)$/i }
    ];
    for (const pattern of patterns) {
      const idx = posix.indexOf(pattern.prefix);
      if (idx === -1) continue;
      let rest = posix.slice(idx + pattern.prefix.length);
      if (pattern.prefix === 'src/routes/' && !pattern.routeRegex.test(`/${rest}`) && !/^\+page\./i.test(rest)) continue;
      rest = rest.replace(/\/\+page\.(js|ts|svelte|md)$/i, '');
      rest = rest.replace(/^\+page\.(js|ts|svelte|md)$/i, '');
      rest = rest.replace(/\.(astro|md|mdx|html|js|ts|jsx|tsx|vue|svelte)$/i, '');
      rest = rest.replace(/\/index$/i, '');
      rest = rest.replace(/\[(\.\.\.)?([^\]]+)\]/g, function (_, spread, name) {
        return spread ? `:${name}*` : `:${name}`;
      });
      return normalizeLocalPath(rest || '/');
    }
    return null;
  }

  function pathFromStaticHtmlFile(relPath) {
    const posix = toPosix(relPath);
    if (!/\.(html|htm)$/i.test(posix)) return [];
    const normalizedFile = normalizeLocalPath(`/${posix}`);
    const baseName = posixBasename(posix).toLowerCase();
    if (baseName === 'index.html' || baseName === 'index.htm') {
      const dirName = posixDirname(posix);
      const folderRoute = dirName === '.' ? '/' : normalizeLocalPath(`/${dirName}`);
      return dedupeIssues([
        { path: folderRoute, file: relPath, line: 1, sourceKind: 'static-html-route' },
        { path: normalizedFile, file: relPath, line: 1, sourceKind: 'static-html-route' }
      ], (item) => `${item.file}:${item.path}`);
    }
    return [{ path: normalizedFile, file: relPath, line: 1, sourceKind: 'static-html-route' }];
  }

  function detectFileSystemRoute(relPath) {
    return pathFromPagesFile(relPath) || pathFromAppDirFile(relPath) || pathFromSvelteOrAstro(relPath);
  }

  function frameworkSignalsForFile(relPath) {
    const posix = toPosix(relPath);
    const signals = [];
    if (/(^|\/)(pages|src\/pages)\//.test(posix)) signals.push('filesystem-pages');
    if (/(^|\/)(app|src\/app)\//.test(posix)) signals.push('filesystem-app');
    if (/(^|\/)src\/routes\//.test(posix)) signals.push('sveltekit-routes');
    if (/(^|\/)src\/pages\//.test(posix) && /\.astro$/i.test(posix)) signals.push('astro-pages');
    if (/\.(html|htm)$/i.test(posix)) signals.push('static-html');
    return signals;
  }

  function makeRouteDeclaration(pathValue, file, line, sourceKind) {
    const normalized = normalizeLocalPath(pathValue);
    if (!normalized) return null;
    return { path: normalized, file, line, sourceKind };
  }

  function detectRouteDeclarations(relPath, text) {
    const declarations = [];
    const patterns = [
      { regex: /<Route\b[^>]*\bpath\s*=\s*["'`]([^"'`{}]+)["'`]/g, kind: 'react-route' },
      { regex: /\bpath\s*:\s*["'`]([^"'`{}]+)["'`]/g, kind: 'route-object' },
      { regex: /\b(?:app|router)\.(?:get|post|put|patch|delete|all|use)\(\s*["'`]([^"'`{}]+)["'`]/g, kind: 'server-route' }
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text))) {
        const issue = makeRouteDeclaration(match[1], relPath, lineNumberAt(text, match.index), pattern.kind);
        if (issue) declarations.push(issue);
      }
    }
    const fsRoute = detectFileSystemRoute(relPath);
    if (fsRoute) declarations.push({ path: fsRoute, file: relPath, line: 1, sourceKind: 'filesystem-route' });
    declarations.push.apply(declarations, pathFromStaticHtmlFile(relPath));
    return dedupeIssues(declarations, (item) => `${item.file}:${item.line}:${item.path}:${item.sourceKind}`);
  }

  function pushReference(collection, pathValue, file, line, kind, rawValue) {
    const normalized = normalizeReferencePath(pathValue, file, kind);
    if (!normalized) return;
    collection.push({ path: normalized, file, line, kind, rawValue: rawValue || pathValue });
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function detectNavigationHelpers(text) {
    const helperNames = new Set();
    const bodySignals = /window\.location(?:\.href)?\s*=|location\.(?:assign|replace)\(|(?:router|history)\.(?:push|replace)\(|\bnavigate\(|\bredirect\(/;
    const arrowBlockPatterns = [
      /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\(([^)]*)\)\s*=>\s*{([\s\S]*?)}/g,
      /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*{([\s\S]*?)}/g
    ];
    for (const regex of arrowBlockPatterns) {
      let match;
      while ((match = regex.exec(text))) {
        const name = match[1];
        const params = (match[2] || '').split(',').map((part) => part.trim()).filter(Boolean);
        const body = match[3] || '';
        if (params.length && bodySignals.test(body)) helperNames.add(name);
      }
    }
    const functionPattern = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*{([\s\S]*?)}/g;
    let fnMatch;
    while ((fnMatch = functionPattern.exec(text))) {
      const name = fnMatch[1];
      const params = fnMatch[2].split(',').map((part) => part.trim()).filter(Boolean);
      const body = fnMatch[3] || '';
      if (params.length && bodySignals.test(body)) helperNames.add(name);
    }
    return Array.from(helperNames);
  }

  function detectRouteReferences(relPath, text) {
    const references = [];
    const patterns = [
      { regex: /<a\b[^>]*\bhref\s*=\s*["'`]([^"'`]+)["'`]/g, kind: 'href' },
      { regex: /<(?:Link|NavLink)\b[^>]*\bto\s*=\s*["'`]([^"'`]+)["'`]/g, kind: 'to' },
      { regex: /\b(?:navigate|redirect|router\.push|router\.replace|history\.push|history\.replace)\(\s*["'`]([^"'`]+)["'`]/g, kind: 'navigation-call' },
      { regex: /window\.location(?:\.href)?\s*=\s*["'`]([^"'`]+)["'`]/g, kind: 'window-location' },
      { regex: /location\.(?:assign|replace)\(\s*["'`]([^"'`]+)["'`]/g, kind: 'location-method' },
      { regex: /\b(?:href|to|url)\s*:\s*["'`]([^"'`]+)["'`]/g, kind: 'object-link' }
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text))) {
        pushReference(references, match[1], relPath, lineNumberAt(text, match.index), pattern.kind, match[1]);
      }
    }
    for (const helperName of detectNavigationHelpers(text)) {
      const helperRegex = new RegExp('\\b' + escapeRegex(helperName) + '\\(\\s*["\']([^"\']+)["\']', 'g');
      let match;
      while ((match = helperRegex.exec(text))) {
        pushReference(references, match[1], relPath, lineNumberAt(text, match.index), 'navigation-helper', match[1]);
      }
    }
    return dedupeIssues(references, (item) => `${item.file}:${item.line}:${item.path}:${item.kind}`);
  }

  function detectPlaceholderControls(relPath, text) {
    const placeholders = [];
    const patterns = [
      { regex: /<a\b[^>]*\bhref\s*=\s*["'`](#|javascript:void\(0\)|javascript:;?)["'`]/gi, kind: 'href-placeholder' },
      { regex: /<(?:Link|NavLink)\b[^>]*\bto\s*=\s*["'`](#|javascript:void\(0\)|javascript:;?)["'`]/gi, kind: 'to-placeholder' },
      { regex: /\b(?:href|to)\s*:\s*["'`](#|javascript:void\(0\)|javascript:;?)["'`]/gi, kind: 'object-placeholder' }
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text))) {
        placeholders.push({
          file: relPath,
          line: lineNumberAt(text, match.index),
          kind: pattern.kind,
          rawValue: match[1]
        });
      }
    }
    return dedupeIssues(placeholders, (item) => `${item.file}:${item.line}:${item.kind}:${item.rawValue}`);
  }

  function detectCommandSignals(relPath, text) {
    const registered = [];
    const executed = [];
    const registrationPatterns = [
      /registerCommand\(\s*["'`]([^"'`]+)["'`]/g,
      /commands\.registerCommand\(\s*["'`]([^"'`]+)["'`]/g
    ];
    const executionPatterns = [
      /executeCommand\(\s*["'`]([^"'`]+)["'`]/g,
      /commands\.executeCommand\(\s*["'`]([^"'`]+)["'`]/g
    ];
    for (const regex of registrationPatterns) {
      let match;
      while ((match = regex.exec(text))) {
        registered.push({ command: match[1], file: relPath, line: lineNumberAt(text, match.index), kind: 'registered' });
      }
    }
    for (const regex of executionPatterns) {
      let match;
      while ((match = regex.exec(text))) {
        executed.push({ command: match[1], file: relPath, line: lineNumberAt(text, match.index), kind: 'executed' });
      }
    }
    return { registered, executed };
  }


  function shouldScanNavigationPatterns(relPath) {
    const ext = posixExtname(relPath);
    if (ext !== '.json') return true;
    const base = posixBasename(relPath).toLowerCase();
    return base === 'package.json' || /route|router|navigation|menu|command/.test(base);
  }

  function shouldScanCommandPatterns(relPath) {
    const ext = posixExtname(relPath);
    if (ext !== '.json') return true;
    const base = posixBasename(relPath).toLowerCase();
    return base === 'package.json' || /command|menu|keybinding/.test(base);
  }

  function isRedirectAliasEntry(relPath, text) {
    if (!/\.(html|htm)$/i.test(relPath)) return false;
    const body = String(text);
    return /http-equiv\s*=\s*["']refresh["']/i.test(body) || /window\.location(?:\.href)?\s*=|location\.(?:assign|replace)\(/.test(body);
  }

  function analyzePackageCommandsFromText(relPath, text) {
    try {
      const pkg = JSON.parse(text);
      const contributed = [];
      const menuRefs = [];
      const keyRefs = [];
      const commandItems = Array.isArray(pkg.contributes && pkg.contributes.commands) ? pkg.contributes.commands : [];
      for (const item of commandItems) {
        if (item && typeof item.command === 'string') {
          contributed.push({ command: item.command, file: relPath, line: 1, kind: 'contributed' });
        }
      }
      const menuMap = (pkg.contributes && pkg.contributes.menus) || {};
      for (const value of Object.values(menuMap)) {
        if (!Array.isArray(value)) continue;
        for (const item of value) {
          if (item && typeof item.command === 'string') {
            menuRefs.push({ command: item.command, file: relPath, line: 1, kind: 'menu-reference' });
          }
        }
      }
      const keybindings = Array.isArray(pkg.contributes && pkg.contributes.keybindings) ? pkg.contributes.keybindings : [];
      for (const item of keybindings) {
        if (item && typeof item.command === 'string') {
          keyRefs.push({ command: item.command, file: relPath, line: 1, kind: 'keybinding-reference' });
        }
      }
      return { contributed, menuRefs, keyRefs };
    } catch (error) {
      return { contributed: [], menuRefs: [], keyRefs: [] };
    }
  }

  function isBuiltinCommand(commandId) {
    return /^(vscode\.|workbench\.|editor\.|markdown\.|git\.|notebook\.|cursor\.)/.test(commandId);
  }

  function patternFromDeclaredPath(declaredPath) {
    const escaped = declaredPath
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z0-9_]+)\*/g, '.*')
      .replace(/:([A-Za-z0-9_]+)/g, '[^/]+');
    return new RegExp(`^${escaped}$`);
  }

  function matchesDeclaredRoute(referencePath, declaredPath) {
    if (referencePath === declaredPath) return true;
    if (referencePath === '/' && declaredPath === '/') return true;
    if (declaredPath.includes(':')) {
      return patternFromDeclaredPath(declaredPath).test(referencePath);
    }
    return false;
  }

  function shouldIncludeEntry(relPath, excludes) {
    const ext = posixExtname(relPath);
    if (!TEXT_EXTENSIONS.has(ext)) return false;
    const segments = splitSegments(relPath);
    return !segments.some((segment) => excludes.has(segment));
  }

  function scanWorkspaceEntries(entries, options) {
    const scanOptions = options || {};
    const excludes = new Set(Array.isArray(scanOptions.exclude) && scanOptions.exclude.length ? scanOptions.exclude : DEFAULT_EXCLUDES);
    const normalizedEntries = (Array.isArray(entries) ? entries : [])
      .map((entry) => ({ path: toPosix(entry.path || ''), text: String(entry.text || '') }))
      .filter((entry) => entry.path && shouldIncludeEntry(entry.path, excludes));

    const frameworks = new Set();
    const declaredRoutes = [];
    const routeReferences = [];
    const placeholders = [];
    const contributedCommands = [];
    const registeredCommands = [];
    const redirectAliasFiles = new Set();
    const executedCommands = [];
    const menuCommands = [];
    const keybindingCommands = [];

    for (const entry of normalizedEntries) {
      if (isRedirectAliasEntry(entry.path, entry.text)) {
        redirectAliasFiles.add(entry.path);
      }
      if (shouldScanNavigationPatterns(entry.path)) {
        frameworkSignalsForFile(entry.path).forEach((signal) => frameworks.add(signal));
        declaredRoutes.push.apply(declaredRoutes, detectRouteDeclarations(entry.path, entry.text));
        routeReferences.push.apply(routeReferences, detectRouteReferences(entry.path, entry.text));
        placeholders.push.apply(placeholders, detectPlaceholderControls(entry.path, entry.text));
      }
      if (shouldScanCommandPatterns(entry.path)) {
        const commandSignals = detectCommandSignals(entry.path, entry.text);
        registeredCommands.push.apply(registeredCommands, commandSignals.registered);
        executedCommands.push.apply(executedCommands, commandSignals.executed);
      }
      if (posixBasename(entry.path) === 'package.json') {
        const packageSignals = analyzePackageCommandsFromText(entry.path, entry.text);
        contributedCommands.push.apply(contributedCommands, packageSignals.contributed);
        menuCommands.push.apply(menuCommands, packageSignals.menuRefs);
        keybindingCommands.push.apply(keybindingCommands, packageSignals.keyRefs);
      }
    }

    const declaredRouteList = dedupeIssues(declaredRoutes, (item) => `${item.path}:${item.file}:${item.line}`);
    const routeRefList = dedupeIssues(routeReferences, (item) => `${item.path}:${item.file}:${item.line}:${item.kind}`);
    const placeholderList = dedupeIssues(placeholders, (item) => `${item.file}:${item.line}:${item.kind}:${item.rawValue}`);

    const deadRouteRefs = routeRefList.filter((reference) => {
      if (reference.path.startsWith('../')) return false;
      return !declaredRouteList.some((declared) => matchesDeclaredRoute(reference.path, declared.path));
    });

    const orphanRoutes = declaredRouteList.filter((declared) => {
      if (declared.path === '/' || declared.path === '/index.html') return false;
      if (redirectAliasFiles.has(declared.file)) return false;
      return !routeRefList.some((reference) => matchesDeclaredRoute(reference.path, declared.path));
    });

    const contributedIds = new Set(contributedCommands.map((item) => item.command));
    const registeredIds = new Set(registeredCommands.map((item) => item.command));

    const unregisteredContributed = dedupeIssues(
      contributedCommands.filter((item) => !registeredIds.has(item.command)),
      (item) => `${item.command}:${item.file}`
    );

    const deadExecutedCommands = dedupeIssues(
      executedCommands.filter((item) => !registeredIds.has(item.command) && !contributedIds.has(item.command) && !isBuiltinCommand(item.command)),
      (item) => `${item.command}:${item.file}:${item.line}`
    );

    const deadMenuCommands = dedupeIssues(
      menuCommands.filter((item) => !registeredIds.has(item.command) && !contributedIds.has(item.command)),
      (item) => `${item.command}:${item.file}:${item.kind}`
    );

    const deadKeybindingCommands = dedupeIssues(
      keybindingCommands.filter((item) => !registeredIds.has(item.command) && !contributedIds.has(item.command)),
      (item) => `${item.command}:${item.file}:${item.kind}`
    );

    return {
      generatedAt: new Date().toISOString(),
      workspaceRoot: scanOptions.workspaceRoot || '',
      workspaceName: scanOptions.workspaceName || 'workspace',
      frameworkSignals: Array.from(frameworks).sort(),
      summary: {
        filesScanned: normalizedEntries.length,
        routesDeclared: declaredRouteList.length,
        routeReferences: routeRefList.length,
        deadRouteReferences: deadRouteRefs.length,
        orphanRoutes: orphanRoutes.length,
        placeholderControls: placeholderList.length,
        contributedCommands: contributedCommands.length,
        registeredCommands: registeredCommands.length,
        executedCommands: executedCommands.length,
        deadExecutedCommands: deadExecutedCommands.length,
        unregisteredContributedCommands: unregisteredContributed.length,
        deadMenuCommands: deadMenuCommands.length,
        deadKeybindingCommands: deadKeybindingCommands.length
      },
      declaredRoutes: declaredRouteList.sort((a, b) => a.path.localeCompare(b.path)),
      routeReferences: routeRefList.sort((a, b) => a.path.localeCompare(b.path)),
      deadRouteReferences: deadRouteRefs.sort((a, b) => a.path.localeCompare(b.path)),
      orphanRoutes: orphanRoutes.sort((a, b) => a.path.localeCompare(b.path)),
      placeholderControls: placeholderList.sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`)),
      commands: {
        contributed: dedupeIssues(contributedCommands, (item) => `${item.command}:${item.file}`),
        registered: dedupeIssues(registeredCommands, (item) => `${item.command}:${item.file}:${item.line}`),
        executed: dedupeIssues(executedCommands, (item) => `${item.command}:${item.file}:${item.line}`),
        menuReferences: dedupeIssues(menuCommands, (item) => `${item.command}:${item.file}`),
        keybindingReferences: dedupeIssues(keybindingCommands, (item) => `${item.command}:${item.file}`),
        deadExecuted: deadExecutedCommands,
        unregisteredContributed,
        deadMenuCommands,
        deadKeybindingCommands
      }
    };
  }

  return {
    TEXT_EXTENSIONS: Array.from(TEXT_EXTENSIONS),
    DEFAULT_EXCLUDES: Array.from(DEFAULT_EXCLUDES),
    normalizeLocalPath,
    normalizeReferencePath,
    matchesDeclaredRoute,
    scanWorkspaceEntries
  };
}));
