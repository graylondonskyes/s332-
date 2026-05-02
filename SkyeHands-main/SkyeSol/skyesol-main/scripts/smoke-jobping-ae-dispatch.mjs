import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const adapterFile = path.join(root, "Platforms-Apps-Infrastructure", "SkyeRoutex", "app-fabric", "adapters", "jobping-ae-dispatch.v1.json");
const adapter = JSON.parse(fs.readFileSync(adapterFile, "utf8"));

assert.equal(adapter.status, "active");
assert.equal(adapter.contract.auth.provider, "SkyGate");
assert.equal(adapter.contract.auth.required, true);
assert(adapter.capabilities.includes("dispatch"));
assert(adapter.capabilities.includes("open-house"));
assert(adapter.capabilities.includes("restaurant-staffing"));
assert(adapter.integratesWith.includes("ae-flow"));
assert(adapter.integratesWith.includes("kaixugateway13"));
assert(adapter.dispatchSystem.queues.includes("restaurant.coverage"));
assert(adapter.dispatchSystem.queues.includes("openhouse.staffing"));
assert(adapter.dispatchSystem.entrypoints.includes("restaurant_shift_gap"));
assert(adapter.dispatchSystem.entrypoints.includes("open_house_staffing_request"));

for (const required of adapter.qa.requiredFiles) {
  const resolved = path.resolve(path.dirname(adapterFile), required);
  assert(fs.existsSync(resolved), `Missing adapter required file: ${required}`);
}

const routeNames = adapter.dispatchSystem.routingRules.map((rule) => rule.queue);
assert(routeNames.includes("restaurant.coverage"));
assert(routeNames.includes("openhouse.staffing"));
assert(routeNames.includes("ae.priority"));

console.log(JSON.stringify({
  ok: true,
  adapter: path.relative(root, adapterFile),
  queues: adapter.dispatchSystem.queues,
  entrypoints: adapter.dispatchSystem.entrypoints,
  auth: adapter.contract.auth,
}, null, 2));
