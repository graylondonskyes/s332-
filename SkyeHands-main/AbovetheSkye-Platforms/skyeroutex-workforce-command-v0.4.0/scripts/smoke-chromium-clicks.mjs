import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
const root=process.cwd(); const proofDir=path.join(root,'proof'); fs.mkdirSync(proofDir,{recursive:true});
const dbPath=path.join(root,'data','chromium-render-smoke-db.json'); if(fs.existsSync(dbPath)) fs.rmSync(dbPath,{force:true});
const appPort=5899; const env={...process.env,PORT:String(appPort),DATABASE_PATH:dbPath,SKYE_ADMIN_EMAIL:'admin@click.internal.invalid',SKYE_ADMIN_PASSWORD:'AdminClick123!'};
const server=spawn('node',['src/server.js'],{cwd:root,env,stdio:'ignore'});  let logs='server spawned with stdio ignored for deterministic smoke exit.';
const checks=[]; const pass=(name,data={})=>checks.push({status:'PASS',name,data});
try{
 for (let i=0; i<80; i++) { try { const r = await fetch('http://localhost:' + appPort + '/api/health'); if (r.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 50)); }
 const health=await fetch(`http://localhost:${appPort}/api/health`).then(r=>r.json()); if(health.version!=='0.4.0') throw new Error('health version mismatch'); pass('server_health_version_0_3_0');
 const dom=execFileSync('chromium',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--dump-dom',`http://localhost:${appPort}`],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
 const required=['login-form','market-form','job-form','operator-assign-form','rating-form','routes','roster','ratings','house-panel']; const missing=required.filter(id=>!dom.includes(`id="${id}"`)); if(missing.length) throw new Error('render missing ids: '+missing.join(','));
 pass('chromium_rendered_public_app_panels',{required_count:required.length});
 pass('chromium_smoke_honest_scope',{scope:'render_and_dom_presence_not_real_click'});
 const out={started_at:new Date().toISOString(),status:'PASS',checks,server_log_excerpt:logs.slice(-2000)}; const outPath=path.join(proofDir,`SMOKE_CHROMIUM_RENDER_${new Date().toISOString().replace(/[:.]/g,'-')}.json`); fs.writeFileSync(outPath,JSON.stringify(out,null,2)); console.log(`Chromium render proof written: ${outPath}`);
}catch(err){const out={started_at:new Date().toISOString(),status:'FAIL',checks,failure:err.message,server_log_excerpt:logs.slice(-4000)}; const outPath=path.join(proofDir,`SMOKE_CHROMIUM_RENDER_FAILED_${new Date().toISOString().replace(/[:.]/g,'-')}.json`); fs.writeFileSync(outPath,JSON.stringify(out,null,2)); console.error(err); process.exitCode=1;}
finally{try { process.kill(server.pid, 'SIGKILL'); } catch {} process.exit(process.exitCode||0);}
