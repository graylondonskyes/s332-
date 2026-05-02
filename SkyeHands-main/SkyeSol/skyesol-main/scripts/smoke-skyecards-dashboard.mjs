import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const gateway = path.join(root, "Platforms-Apps-Infrastructure", "kAIxUGateway13");
const page = path.join(gateway, "skyecards.html");
const css = path.join(gateway, "assets", "skyecards.css");
const js = path.join(gateway, "assets", "skyecards.js");

for (const file of [page, css, js]) {
  assert(fs.existsSync(file), `Missing SkyeCards dashboard asset: ${path.relative(root, file)}`);
}

const html = fs.readFileSync(page, "utf8");
const script = fs.readFileSync(js, "utf8");

assert(html.includes("SkyeCards"));
assert(html.includes("Open Dashboard"));
assert(html.includes("AI Boost"));
assert(html.includes("Push Pack"));
assert(html.includes("Launch Credit"));
assert(html.includes("Audit Pack"));
assert(html.includes("SkyGate token"));
assert(html.includes("assets/skyecards.css"));
assert(html.includes("assets/skyecards.js"));

assert(script.includes("/.netlify/functions/skye-cards"));
assert(script.includes("/.netlify/functions/skye-card-setup-checkout"));
assert(script.includes("/.netlify/functions/skye-card-offer-checkout"));
assert(script.includes("localStorage"));

console.log(JSON.stringify({
  ok: true,
  page: path.relative(root, page),
  assets: [path.relative(root, css), path.relative(root, js)],
  dashboard: ["balances", "setup", "monthly-benefits", "offer-checkout"],
}, null, 2));
