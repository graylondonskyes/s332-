import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envTemplatePath = path.join(projectRoot, "env.ultimate.template");
const repoEnvCatalogPath = path.join(projectRoot, "netlify", "functions", "_lib", "repoEnvCatalog.js");

function parseEnvTemplate(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const vars = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)\s*=/.exec(trimmed);
    if (match) vars.push(match[1]);
  }
  return vars;
}

const catalogModule = await import(pathToFileURL(repoEnvCatalogPath).href);
const catalogSections = catalogModule.getRepoEnvSections();
const catalogVars = catalogSections.flatMap((section) => section.vars.map((entry) => entry.name));
const templateVars = parseEnvTemplate(envTemplatePath);

const templateSet = new Set(templateVars);
const catalogSet = new Set(catalogVars);

const missingInTemplate = catalogVars.filter((name) => !templateSet.has(name));
const uncataloguedInTemplate = templateVars.filter((name) => !catalogSet.has(name));
const duplicates = templateVars.filter((name, index) => templateVars.indexOf(name) !== index);

const result = {
  canonical_template: "env.ultimate.template",
  template_var_count: templateSet.size,
  catalog_var_count: catalogSet.size,
  catalog_entry_count: catalogVars.length,
  sections: catalogSections.length,
  missing_in_template: missingInTemplate,
  uncatalogued_in_template: uncataloguedInTemplate,
  duplicate_vars: [...new Set(duplicates)]
};

console.log(JSON.stringify(result, null, 2));

if (missingInTemplate.length || duplicates.length) {
  process.exitCode = 1;
}
