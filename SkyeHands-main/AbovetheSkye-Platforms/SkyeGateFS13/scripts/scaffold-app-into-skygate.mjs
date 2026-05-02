#!/usr/bin/env node
import fs from "fs";
import path from "path";

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  ".netlify",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vite"
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".cjs", ".mjs",
  ".ts", ".tsx", ".jsx",
  ".json", ".html", ".md",
  ".toml", ".txt", ".yaml", ".yml",
  ".css", ".sql"
]);

function parseArgs(argv) {
  const args = {
    outDir: path.resolve(process.cwd(), "docs/integration-dossiers"),
    gateProjectPath: path.resolve(process.cwd()),
    gateEnvVar: "SKYGATEFS13_ORIGIN",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--app-path") args.appPath = next;
    if (arg === "--app-id") args.appId = next;
    if (arg === "--out-dir") args.outDir = next;
    if (arg === "--gate-project-path") args.gateProjectPath = next;
    if (arg === "--gate-env-var") args.gateEnvVar = next;
    if (arg.startsWith("--")) i += 1;
  }
  if (!args.appPath) {
    throw new Error("Missing --app-path");
  }
  args.appPath = path.resolve(args.appPath);
  args.appId = slugify(args.appId || path.basename(args.appPath));
  args.outDir = path.resolve(args.outDir);
  args.gateProjectPath = path.resolve(args.gateProjectPath);
  return args;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

function walk(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, list);
      continue;
    }
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext) || entry.name === "netlify.toml" || entry.name === "package.json") {
        list.push(full);
      }
    }
  }
  return list;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function findMatches(content, regex) {
  return [...content.matchAll(regex)].map((match) => match[1] || match[0]);
}

function relativeTo(base, target) {
  return path.relative(base, target) || ".";
}

function analyzeApp({ appPath, appId, gateEnvVar, gateProjectPath }) {
  const files = walk(appPath);
  const endpointHits = [];
  const authIndicators = [];
  const redirects = [];
  const envIndicators = [];

  const legacyEndpointRegex = /(?:\/api\/(?:auth-[a-z0-9-]+|token-(?:issue|list|revoke))|\/auth\/[a-z0-9-]+|\/oauth\/[a-z0-9-]+|\/session\/token|\/\.well-known\/[a-z0-9._-]+)/gi;
  const storageRegex = /\bkx\.api\.(?:accessToken|tokenEmail)\b|SkyeStandaloneSession|requireUser\b|ADMIN_PASSWORD|ADMIN_JWT_SECRET|TOKEN_MASTER_SEQUENCE|auth-pin-(?:set|unlock)/g;
  const gateRegex = /\bSKYGATEFS13_ORIGIN\b|\bSKYGATE_AUTH_ORIGIN\b|\bSKYGATE_ORIGIN\b/g;

  for (const file of files) {
    const content = safeRead(file);
    if (!content) continue;
    const rel = relativeTo(appPath, file);

    for (const hit of uniq(findMatches(content, legacyEndpointRegex))) {
      endpointHits.push({ file: rel, value: hit });
    }
    for (const hit of uniq(findMatches(content, storageRegex))) {
      authIndicators.push({ file: rel, value: hit });
    }
    for (const hit of uniq(findMatches(content, gateRegex))) {
      envIndicators.push({ file: rel, value: hit });
    }

    if (path.basename(file) === "netlify.toml") {
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.includes('from = "/api/') || line.includes('to = "/.netlify/functions/')) {
          redirects.push({ file: rel, line: i + 1, value: line.trim() });
        }
      }
    }
  }

  const uniqueEndpoints = uniq(endpointHits.map((item) => item.value)).sort();
  const uniqueIndicators = uniq(authIndicators.map((item) => item.value)).sort();

  const recommendations = [];
  recommendations.push("Route primary identity through SkyeGateFS13 `/auth/*`, `/oauth/*`, and `/.well-known/*`.");
  if (uniqueEndpoints.some((value) => value.startsWith("/api/auth-"))) {
    recommendations.push("Keep `/api/auth-*` only as same-origin compatibility adapters backed by SkyeGateFS13.");
  }
  if (uniqueEndpoints.some((value) => value.includes("token-issue") || value.includes("token-list") || value.includes("token-revoke"))) {
    recommendations.push("Gate token issue/list/revoke behind central identity, and mirror issuance activity into the parent gate ledger.");
  }
  if (uniqueIndicators.includes("SkyeStandaloneSession") || uniqueIndicators.includes("kx.api.accessToken")) {
    recommendations.push("Reduce local storage/session helpers to client bridges only; do not mint primary identity locally.");
  }
  if (uniqueIndicators.includes("requireUser")) {
    recommendations.push("Patch local protected routes so `requireUser` or equivalent trusts SkyeGateFS13 bearer/cookie identity first.");
  }
  recommendations.push(`Set ${gateEnvVar} in the consumer runtime so same-origin adapters can call the deployed SkyeGateFS13.`);
  recommendations.push("Mirror login, token issuance, gateway use, and GitHub/Netlify push actions into SkyeGateFS13 parent audit/usage tables.");

  return {
    generated_at: new Date().toISOString(),
    app_id: appId,
    app_path: appPath,
    gate_project_path: gateProjectPath,
    gate_env_var: gateEnvVar,
    summary: {
      scanned_files: files.length,
      legacy_endpoint_count: uniqueEndpoints.length,
      auth_indicator_count: uniqueIndicators.length,
      netlify_redirect_count: redirects.length,
    },
    legacy_endpoints: uniqueEndpoints,
    endpoint_hits: endpointHits,
    auth_indicators: uniqueIndicators,
    auth_indicator_hits: authIndicators,
    netlify_redirect_hits: redirects,
    gate_env_hits: envIndicators,
    recommendations,
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push(`# SkyeGateFS13 Integration Dossier: ${report.app_id}`);
  lines.push("");
  lines.push(`- Generated: \`${report.generated_at}\``);
  lines.push(`- App path: \`${report.app_path}\``);
  lines.push(`- Gate env var: \`${report.gate_env_var}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Scanned files: ${report.summary.scanned_files}`);
  lines.push(`- Legacy endpoints found: ${report.summary.legacy_endpoint_count}`);
  lines.push(`- Auth indicators found: ${report.summary.auth_indicator_count}`);
  lines.push(`- Netlify redirect hits: ${report.summary.netlify_redirect_count}`);
  lines.push("");
  lines.push("## Legacy Endpoints");
  lines.push("");
  if (!report.legacy_endpoints.length) lines.push("- None found");
  for (const endpoint of report.legacy_endpoints) lines.push(`- \`${endpoint}\``);
  lines.push("");
  lines.push("## Auth Indicators");
  lines.push("");
  if (!report.auth_indicators.length) lines.push("- None found");
  for (const indicator of report.auth_indicators) lines.push(`- \`${indicator}\``);
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");
  for (const recommendation of report.recommendations) lines.push(`- ${recommendation}`);
  lines.push("");
  lines.push("## Endpoint Hits");
  lines.push("");
  if (!report.endpoint_hits.length) lines.push("- None");
  for (const hit of report.endpoint_hits) lines.push(`- \`${hit.value}\` in \`${hit.file}\``);
  lines.push("");
  lines.push("## Redirect Hits");
  lines.push("");
  if (!report.netlify_redirect_hits.length) lines.push("- None");
  for (const hit of report.netlify_redirect_hits) lines.push(`- \`${hit.file}:${hit.line}\` → \`${hit.value}\``);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = analyzeApp(args);
  ensureDir(args.outDir);
  const baseName = path.join(args.outDir, args.appId);
  fs.writeFileSync(`${baseName}.json`, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(`${baseName}.md`, toMarkdown(report));
  console.log(JSON.stringify({
    ok: true,
    app_id: args.appId,
    json: `${baseName}.json`,
    markdown: `${baseName}.md`,
    summary: report.summary,
  }, null, 2));
}

main();
