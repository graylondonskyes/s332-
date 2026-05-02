import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const suiteDir = path.join(rootDir, "suite");
const distDir = path.join(rootDir, "dist", "SkyeMail");
const metadataPath = path.join(rootDir, "dist", "suite-build.json");

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.dirname(distDir), { recursive: true });
  await cp(suiteDir, distDir, { recursive: true });
  await writeFile(metadataPath, JSON.stringify({
    built_at: new Date().toISOString(),
    source: "suite/",
    output: "dist/SkyeMail/",
    note: "Sync this tree into a flat public/SkyeMail mount when another host expects route-safe standalone output.",
  }, null, 2));
  process.stdout.write(`Built ${distDir}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
