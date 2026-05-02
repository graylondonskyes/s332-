#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const registryPath = path.join(root, "src", "lib", "superideRegistry.ts");
const routeMapPath = path.join(root, "..", "ROUTE_MAP.md");
const serverPath = path.join(root, "server", "create-server.cjs");

const registry = fs.readFileSync(registryPath, "utf8");
const routeMap = fs.readFileSync(routeMapPath, "utf8");
const server = fs.readFileSync(serverPath, "utf8");

function parseRouteMapSection(title) {
  const marker = `## ${title}`;
  const start = routeMap.indexOf(marker);
  if (start < 0) return [];
  const next = routeMap.indexOf("\n## ", start + marker.length);
  const block = routeMap.slice(start, next < 0 ? routeMap.length : next);
  return [...block.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function registryHasPath(route) {
  return registry.includes(`path: "${route}"`);
}

function serverHasApiRoute(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`pathname(?:\\.startsWith)?\\(['"]${escaped}`).test(server) || server.includes(route);
}

const appRoutes = parseRouteMapSection("App Routes");
const apiRoutes = parseRouteMapSection("API Routes").map((item) => {
  const match = item.match(/^(GET|POST)\s+(.+)$/);
  return match ? { method: match[1], path: match[2] } : null;
}).filter(Boolean);

const errors = [];
for (const route of appRoutes) {
  if (!registryHasPath(route)) errors.push(`Missing app route in registry: ${route}`);
}
for (const route of apiRoutes) {
  if (!registryHasPath(route.path)) errors.push(`Missing API route in registry: ${route.method} ${route.path}`);
  if (!serverHasApiRoute(route.path)) errors.push(`Missing API route in server: ${route.method} ${route.path}`);
}

if (errors.length) {
  console.error("[route-registry] FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[route-registry] PASS app_routes=${appRoutes.length} api_routes=${apiRoutes.length}`);
