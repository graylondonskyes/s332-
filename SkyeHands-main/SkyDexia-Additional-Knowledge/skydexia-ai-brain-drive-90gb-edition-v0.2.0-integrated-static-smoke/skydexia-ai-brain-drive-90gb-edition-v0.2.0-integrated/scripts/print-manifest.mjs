import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("models/90gb-models.manifest.json", "utf8"));
console.log(JSON.stringify(manifest, null, 2));
