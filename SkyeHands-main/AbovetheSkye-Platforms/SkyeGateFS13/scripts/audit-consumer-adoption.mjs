import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gateRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(gateRoot, "../../../..");

const TARGETS = [
  {
    id: "superidev3-8",
    path: path.join(repoRoot, "AbovetheSkye-Platforms/SuperIDEv3.8")
  },
  {
    id: "0s-auth-sdk",
    path: path.join(repoRoot, "SkyeSol/skyesol-main/0s-auth-sdk")
  },
  {
    id: "skyehands-runtime-control",
    path: path.join(repoRoot, "skyehands_runtime_control")
  }
];

const SIGNALS = [
  { key: "skygate_origin_refs", patterns: ["SKYGATEFS13_ORIGIN", "SKYGATE_AUTH_ORIGIN", "SKYGATE_ORIGIN"] },
  { key: "event_mirror_refs", patterns: ["SKYGATE_EVENT_MIRROR_SECRET", "SKYGATEFS13_EVENT_MIRROR_SECRET", "/platform/events"] },
  { key: "gate_auth_refs", patterns: ["/auth/login", "/auth/signup", "/auth/me", "skygatefs13"] }
];

function walkFiles(rootDir, files = []) {
  if (!fs.existsSync(rootDir)) return files;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".netlify" || entry.name === ".git") continue;
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(filePath, patterns) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return patterns.some((pattern) => text.includes(pattern));
  } catch {
    return false;
  }
}

const report = TARGETS.map((target) => {
  const files = walkFiles(target.path, []);
  const signals = {};
  for (const signal of SIGNALS) {
    signals[signal.key] = files.some((file) => scanFile(file, signal.patterns));
  }
  return {
    id: target.id,
    path: target.path,
    exists: fs.existsSync(target.path),
    file_count: files.length,
    signals,
    adoption_score: Object.values(signals).filter(Boolean).length
  };
});

console.log(JSON.stringify({ generated_at: new Date().toISOString(), targets: report }, null, 2));
