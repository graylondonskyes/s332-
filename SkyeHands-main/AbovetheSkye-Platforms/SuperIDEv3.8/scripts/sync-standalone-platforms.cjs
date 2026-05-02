const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const platformsRoot = path.resolve(projectRoot, "..");
const publicRoot = path.join(projectRoot, "public");
const functionsRoot = path.join(projectRoot, "netlify", "functions");
const skyeMailRoot = path.join(platformsRoot, "SkyeMail");
const skyeMailSuiteRoot = path.join(skyeMailRoot, "suite");
const skyeMailStandaloneFunctionsRoot = path.join(skyeMailRoot, "netlify", "functions");
const skyeMailFunctionSupportRoot = path.join(functionsRoot, "_skymail_standalone");
const skyeMailFunctionPrefix = "skymail-standalone-";
const standalonePublicDir = path.join(publicRoot, "SkyeMail", "standalone");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function replaceInFile(filePath, replacer) {
  const value = fs.readFileSync(filePath, "utf8");
  const next = replacer(value);
  if (next !== value) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function copyFresh(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(path.dirname(targetDir));
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function removeFresh(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyStandaloneRootFiles(sourceDir, targetDir) {
  removeFresh(targetDir);
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "suite" || entry.name === "dist" || entry.name === "netlify" || entry.name === "sql" || entry.name === "tools") continue;
    if (entry.name === "package.json" || entry.name === "package-lock.json" || entry.name === "README.md" || entry.name === ".env.template" || entry.name === "netlify.toml" || entry.name === "_redirects") continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function syncSkyeMailStandalonePublic() {
  if (!fs.existsSync(skyeMailRoot)) {
    throw new Error(`SkyeMail source not found: ${skyeMailRoot}`);
  }
  copyStandaloneRootFiles(skyeMailRoot, standalonePublicDir);
}

function syncSkyeDocxMax() {
  const sourceDir = path.join(platformsRoot, "SkyeDocxMax");
  const targetDir = path.join(publicRoot, "SkyeDocxMax");
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`SkyeDocxMax source not found: ${sourceDir}`);
  }
  copyFresh(sourceDir, targetDir);
}

function syncSkyeMailSuite() {
  const sourceDir = skyeMailSuiteRoot;
  const targetDir = path.join(publicRoot, "SkyeMail");
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`SkyeMail suite source not found: ${sourceDir}`);
  }
  copyFresh(sourceDir, targetDir);
}

function syncSkyeMailFunctions() {
  if (!fs.existsSync(skyeMailStandaloneFunctionsRoot)) {
    throw new Error(`SkyeMail standalone functions source not found: ${skyeMailStandaloneFunctionsRoot}`);
  }
  copyFresh(skyeMailStandaloneFunctionsRoot, skyeMailFunctionSupportRoot);

  const functionEntries = fs.readdirSync(skyeMailStandaloneFunctionsRoot, { withFileTypes: true });
  const sourceFiles = functionEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  const managedWrappers = fs.existsSync(functionsRoot)
    ? fs.readdirSync(functionsRoot).filter((name) => name.startsWith(skyeMailFunctionPrefix) && name.endsWith(".js"))
    : [];
  for (const wrapperName of managedWrappers) {
    fs.rmSync(path.join(functionsRoot, wrapperName), { force: true });
  }

  for (const fileName of sourceFiles) {
    const routeName = `${skyeMailFunctionPrefix}${fileName}`;
    const modulePath = `./_skymail_standalone/${fileName}`.replace(/\.js$/, "");
    const wrapperPath = path.join(functionsRoot, routeName);
    fs.writeFileSync(
      wrapperPath,
      `'use strict';\nmodule.exports = require(${JSON.stringify(modulePath)});\n`,
      "utf8"
    );
  }
}

function writePlatformManifest() {
  const manifestPath = path.join(publicRoot, "standalone-platforms.manifest.json");
  const payload = {
    schema: "skye.standalone.platforms",
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    source_root: platformsRoot,
    platforms: {
      SkyeMail: {
        suite: skyeMailSuiteRoot,
        standalone: skyeMailRoot,
        functions: skyeMailStandaloneFunctionsRoot,
      },
      SkyeDocxMax: path.join(platformsRoot, "SkyeDocxMax"),
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  ensureDir(publicRoot);
  ensureDir(functionsRoot);
  syncSkyeMailSuite();
  syncSkyeMailStandalonePublic();
  syncSkyeMailFunctions();
  syncSkyeDocxMax();
  writePlatformManifest();
  process.stdout.write("[sync-standalone-platforms] synced SkyeMail suite, standalone mount, functions, and SkyeDocxMax from AbovetheSkye-Platforms\n");
}

main();
