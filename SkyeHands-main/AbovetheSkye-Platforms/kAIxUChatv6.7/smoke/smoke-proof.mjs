#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function read(relPath) {
  const full = path.join(root, relPath);
  assert(fs.existsSync(full), `Missing required file: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

const classification = read("ESTATE_CLASSIFICATION.md");
const proofStatus = read("PROOF_STATUS.md");
const html = read("kAIxUChatv67.html");

assert(classification.includes("concept-single-surface"), "classification is missing concept-single-surface");
assert(proofStatus.includes("single branded launch surface"), "proof status is missing single-surface scope");
assert(html.includes("kAIxUchat"), "chat surface title missing");
assert(html.includes("gateway"), "chat surface is missing gateway positioning");
assert(html.includes("server-side"), "chat surface is missing server-side key posture language");

console.log(JSON.stringify({
  ok: true,
  app: "kAIxUChatv6.7",
  surface: "single branded launch surface",
  verified: [
    "single branded chat page exists",
    "the page positions itself as a gateway-backed/server-side-key surface",
    "local classification marks the folder as concept-only"
  ],
  not_proven: [
    "local backend or gateway implementation in this folder",
    "smoke-backed runtime behavior beyond the page contract"
  ]
}, null, 2));
