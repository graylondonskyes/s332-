import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "index.html",
  "dashboard.html",
  "compose.html",
  "contacts.html",
  "settings.html",
  "suite/index.html",
  "suite/apps/mailbox/index.html",
  "suite/apps/command/index.html",
  "suite/apps/campaigns/index.html",
  "suite/apps/ops/index.html",
  "suite/apps/templates/index.html",
  "tools/build-suite-dist.mjs",
  "netlify/functions/auth-login.js",
  "netlify/functions/auth-signup.js",
  "netlify/functions/messages-list.js",
  "netlify/functions/mail-send.js",
  "netlify/functions/google-oauth-start.js",
  "netlify/functions/google-status.js",
  "sql/schema.sql",
];

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    throw new Error(`Missing required standalone file: ${rel}`);
  }
}

const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const rootIndex = read("index.html");
if (!rootIndex.includes("kAIxuGateway13 ready")) {
  throw new Error("Root marketing surface no longer declares the gateway-backed assistant lane.");
}

const suiteIndex = read("suite/index.html");
for (const needle of [
  'data-app-id="SkyeMail"',
  'href="apps/mailbox/index.html"',
  'href="apps/command/index.html"',
]) {
  if (!suiteIndex.includes(needle)) {
    throw new Error(`Suite shell marker missing from suite/index.html: ${needle}`);
  }
}

const mailUi = read("assets/app.js");
for (const needle of [
  "SMV_LOCAL_RUNTIME_V2",
  "localDemoResponse(",
  "Falling back to local demo runtime",
]) {
  if (!mailUi.includes(needle)) {
    throw new Error(`Expected local-runtime marker missing from assets/app.js: ${needle}`);
  }
}

const build = spawnSync(process.execPath, ["tools/build-suite-dist.mjs"], {
  cwd: root,
  encoding: "utf8",
});

if (build.status !== 0) {
  throw new Error(`build:suite failed\n${build.stdout}\n${build.stderr}`);
}

const builtSuiteIndex = path.join(root, "dist", "SkyeMail", "index.html");
if (!existsSync(builtSuiteIndex)) {
  throw new Error("build:suite did not produce dist/SkyeMail/index.html");
}

const metadataPath = path.join(root, "dist", "suite-build.json");
if (!existsSync(metadataPath)) {
  throw new Error("build:suite did not emit dist/suite-build.json");
}

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
if (metadata.source !== "suite/" || metadata.output !== "dist/SkyeMail/") {
  throw new Error("Unexpected suite-build metadata contract.");
}

console.log(JSON.stringify({
  ok: true,
  platform: "SkyeMail",
  proof: [
    "Root standalone pages exist",
    "Suite shell and app mounts exist",
    "Standalone Functions contract files exist",
    "Browser-local demo mailbox runtime exists for no-functions use",
    "Suite build reproduces dist/SkyeMail",
  ],
  limits: [
    "Does not prove live provider credentials",
    "Does not prove deployed Netlify Functions execution",
  ],
}, null, 2));
