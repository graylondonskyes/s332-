#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function countFilesInDir(dir, patterns) {
  const counts = { total: 0, backend: 0, persist: 0, providers: 0, ui: 0, smoke: 0, deploy: 0 };
  
  try {
    async function walk(current, depth) {
      if (depth > 4 || !current.includes('/')) return;
      try {
        const entries = await fs.promises.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next'].some(x => entry.name.includes(x))) {
              await walk(path.join(current, entry.name), depth + 1);
            }
          } else {
            counts.total++;
            const name = entry.name.toLowerCase();
            if (/route\.(ts|js)$|\/api\/|\/functions\/|netlify/.test(name)) counts.backend++;
            if (/schema|migration|prisma|neon|sqlite/.test(name)) counts.persist++;
            if (/openai|anthropic|printful|stripe|cloudflare|github/.test(name)) counts.providers++;
            if (/\.[tj]sx?$|\.html$/.test(name)) counts.ui++;
            if (/test|spec|smoke/.test(name)) counts.smoke++;
            if (/netlify\.toml|vercel|dockerfile|package\.json/.test(name)) counts.deploy++;
          }
        }
      } catch {}
    }
    
    await walk(dir, 0);
  } catch {}
  
  return counts;
}

function grade(scores) {
  const total = Object.values(scores).filter(k => k !== 'total').reduce((a, b) => a + b, 0);
  if (total >= 10 && scores.backend > 0 && scores.persist > 0) return 'PRODUCTION-READY';
  if (total >= 8 && scores.backend > 0 && scores.persist > 0) return 'FUNCTIONAL-PARTIAL';
  if (total >= 5 && scores.backend > 0) return 'SKELETON';
  if (scores.ui > 0) return 'HTML-ONLY';
  return 'UNKNOWN';
}

async function main() {
  console.log('GrayChunks Scanner\n');
  
  const platforms = [
    { name: 'Theia IDE', path: 'platform/ide-core' },
    { name: 'OpenHands Agent', path: 'platform/agent-core' },
    { name: 'JobPing Appointment', path: '../../../Later-Additions/JobPing-legal-ui-proof-pass' },
    { name: 'SkyeRoutex Dispatch', path: '../../../Later-Additions/SkyeRoutexFlow_v83_BULLSHIT_REMOVED_PLATFORM_STACK' },
    { name: 'CodeFloor', path: '../../../Later-Additions/codefloor-v1' },
    { name: 'SkyeCommerce Shopify', path: '../../../Later-Additions/skyecommerce-shopify-replacement-foundation-v1.24.0-bullshit-removed-runtime' },
  ];
  
  const results = [];
  for (const plat of platforms) {
    const fullPath = path.resolve(__dirname, plat.path);
    const exists = await (async () => { try { await fs.promises.access(fullPath); return true; } catch { return false; } })();
    
    let scores = null;
    if (exists) {
      scores = await countFilesInDir(fullPath, {});
    } else {
      scores = { total: 0, backend: 0, persist: 0, providers: 0, ui: 0, smoke: 0, deploy: 0 };
    }
    
    const g = exists ? grade(scores) : 'MISSING';
    results.push({ name: plat.name, grade: g, scores, exists });
    console.log(`${plat.name.padEnd(35)} ${g.padEnd(20)} ${exists ? 'OK' : 'NOT FOUND'}`);
  }
  
  // Write summary
  let md = '# CODE READINESS MATRIX\n\n| Platform | Grade | Backend | Persist | Providers | UI | Tests | Deploy |\n|----------|-------|---------|---------|-----------|----|----|--------|\n';
  for (const r of results) {
    if (r.exists) {
      md += `| ${r.name} | **${r.grade}** | ${r.scores.backend} | ${r.scores.persist} | ${r.scores.providers} | ${r.scores.ui} | ${r.scores.smoke} | ${r.scores.deploy} |\n`;
    } else {
      md += `| ${r.name} | **MISSING** | - | - | - | - | - | - |\n`;
    }
  }
  
  await fs.promises.writeFile(path.join(__dirname, 'CODE_READINESS_MATRIX.md'), md);
  console.log('\nGenerated: CODE_READINESS_MATRIX.md');
}

main();
