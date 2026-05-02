import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const html = read("index.html");

mustContain(html, 'http-equiv="refresh"', "meta refresh");
mustContain(html, "redirect alias only", "alias boundary copy");
mustContain(html, 'location.replace("/Platforms-Apps-Infrastructure/Skye%20Profit%20Console/index.html")', "redirect script");
mustContain(html, "/Platforms-Apps-Infrastructure/Skye%20Profit%20Console/index.html", "redirect target");
mustContain(html, "local ledger lane", "redirect target description");
mustContain(html, 'name="robots" content="noindex, nofollow"', "alias noindex marker");
mustContain(html, "<noscript>", "noscript fallback");

console.log(JSON.stringify({
  ok: true,
  folder: "SkyeProfitConsole",
  status: "partial",
  proof: [
    "redirect-alias-present",
    "alias-boundary-markers-present"
  ]
}, null, 2));
