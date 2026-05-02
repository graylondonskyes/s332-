const fs = require('fs');
const path = require('path');
const { DEFAULT_TOTAL, defaultValuationRecord } = require('./netlify/functions/_lib/housecircle-valuation');
const { defaultWalkthroughRecord } = require('./netlify/functions/_lib/housecircle-walkthrough');
const { readNeonConfig, getNeonHealth, PHC_SCHEMA_SQL } = require('./netlify/functions/_lib/housecircle-neon-store');
(async function(){
  const valuation = defaultValuationRecord();
  const walkthrough = defaultWalkthroughRecord();
  const cfg = readNeonConfig();
  const neon = await getNeonHealth('default-org');
  const out = { ok:true, version:'69.0.0', valuationTotal:valuation.totalValue, expectedTotal:DEFAULT_TOTAL, walkthroughSections:walkthrough.sectionCount, neonConfigured:!!cfg.enabled, neonMode:cfg.mode, pgAvailableAtRuntime:!!neon.pgAvailable, schemaStatementsPresent:/create table if not exists phc_org_snapshots/i.test(PHC_SCHEMA_SQL) && /create table if not exists phc_replica_events/i.test(PHC_SCHEMA_SQL), timestamp:new Date().toISOString() };
  const outDir = path.join(__dirname, 'WHITE_GLOVE_V69'); fs.mkdirSync(outDir, { recursive:true }); fs.writeFileSync(path.join(outDir, 'smoke_output_v69.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2));
})();
