import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const BASE=process.env.SKYDEXIA_BASE_URL||"http://127.0.0.1:8787";
async function check(path,options){const started=Date.now();try{const res=await fetch(`${BASE}${path}`,options);const text=await res.text();let body=text;try{body=JSON.parse(text)}catch{}return{path,ok:res.ok,status:res.status,elapsed_ms:Date.now()-started,body}}catch(err){return{path,ok:false,error:err.message,elapsed_ms:Date.now()-started}}}
const results=[];
results.push(await check("/api/health"));
results.push(await check("/api/space"));
results.push(await check("/api/hardware"));
results.push(await check("/api/models"));
results.push(await check("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({model:"auto",prompt:"Say SkyeDexia 90GB local smoke OK in one sentence."})}));
const pass=results.every(r=>r.ok);
const report={ok:pass,name:"SkyeDexia 90GB local smoke",timestamp:new Date().toISOString(),base:BASE,results};
await mkdir("proof",{recursive:true});
const filename=join("proof",`SMOKE_90GB_LOCAL_${new Date().toISOString().replace(/[:.]/g,"-")}.local.json`);
await writeFile(filename,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
console.log(`Smoke report written: ${filename}`);
process.exit(pass?0:1);
