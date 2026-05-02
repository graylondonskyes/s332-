import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const productRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extensionRoot = path.join(productRoot, 'extensions', 'dead-route-detector-skyevsx');
const packageJsonPath = path.join(extensionRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const distDir = path.join(productRoot, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drr-vsix-'));
const staging = path.join(tmpDir, 'vsix');
const stagingExtension = path.join(staging, 'extension');
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(extensionRoot, stagingExtension, { recursive: true });

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="css" ContentType="text/css" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="xml" ContentType="application/xml" />
</Types>
`;

const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${escapeXml(pkg.publisher)}.${escapeXml(pkg.name)}" Version="${escapeXml(pkg.version)}" Publisher="${escapeXml(pkg.publisher)}" />
    <DisplayName>${escapeXml(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(pkg.description)}</Description>
    <Tags>${escapeXml((pkg.keywords || []).join(','))}</Tags>
    <Categories>${escapeXml((pkg.categories || []).join(','))}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${escapeXml(pkg.engines?.vscode || '^1.80.0')}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" />
  </Assets>
</PackageManifest>
`;

fs.writeFileSync(path.join(staging, '[Content_Types].xml'), contentTypes, 'utf8');
fs.writeFileSync(path.join(staging, 'extension.vsixmanifest'), vsixManifest, 'utf8');

const outFile = path.join(distDir, `${pkg.name}-${pkg.version}.vsix`);
try {
  fs.rmSync(outFile, { force: true });
} catch {}
execFileSync('zip', ['-qr', outFile, '.'], { cwd: staging, stdio: 'inherit' });
console.log(outFile);
