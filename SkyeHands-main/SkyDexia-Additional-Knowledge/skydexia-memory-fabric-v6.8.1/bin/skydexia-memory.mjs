#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSkyDexiaMemory } from '../src/index.mjs';
function parse(argv){const o={_:[]};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2),n=argv[i+1];if(!n||n.startsWith('--'))o[k]=true;else{o[k]=n;i++;}}else o._.push(a);}return o;}
function help(){console.log(`SkyDexia Memory Fabric v6.8.1\n\nCommands:\n  init --project <id>\n  remember --title <title> --text <text> [--type note] [--tag a,b]\n  recall <query>\n  inject --target AGENTS.md --query <query>\n  export --out memory-pack.json\n  import --file memory-pack.json\n`);}
async function main(){const [cmd,...rest]=process.argv.slice(2);const o=parse(rest);if(!cmd||cmd==='help'||cmd==='--help')return help();const projectId=o.project||process.env.SKYDEXIA_PROJECT_ID||path.basename(process.cwd());const rootDir=o.root||process.env.SKYDEXIA_MEMORY_ROOT||path.join(process.cwd(),'.skydexia-memory');const memory=createSkyDexiaMemory({mode:o.mode||'local-sidecar',projectId,actorId:o.actor||'skydexia',storage:{kind:'local-jsonl',rootDir}});
if(cmd==='init'){await memory.init();console.log(JSON.stringify({ok:true,version:memory.version,projectId,rootDir},null,2));return;}
if(cmd==='remember'){await memory.init();const text=o.text||(o.file?await fs.readFile(path.resolve(o.file),'utf8'):'');const m=await memory.remember({type:o.type||'note',title:o.title||text.slice(0,80)||'Untitled memory',tags:o.tag||o.tags||'',text,evidence:o.evidence?JSON.parse(o.evidence):{}});console.log(JSON.stringify(m,null,2));return;}
if(cmd==='recall'||cmd==='search'){await memory.init();const r=await memory.recall({query:o.query||o._.join(' '),limit:Number(o.limit||8)});console.log(r.contextText);return;}
if(cmd==='inject'){await memory.init();const r=await memory.inject({target:o.target||'AGENTS.md',query:o.query||o._.join(' '),limit:Number(o.limit||8)});console.log(JSON.stringify({ok:true,target:r.target,memoryCount:r.recalled.count},null,2));return;}
if(cmd==='export'){await memory.init();const pack=await memory.exportPack();const out=path.resolve(o.out||`skydexia-memory-pack-${projectId}.json`);await fs.writeFile(out,JSON.stringify(pack,null,2)+'\n');console.log(JSON.stringify({ok:true,out},null,2));return;}
if(cmd==='import'){await memory.init();if(!o.file)throw new Error('import requires --file');const pack=JSON.parse(await fs.readFile(path.resolve(o.file),'utf8'));let count=0;for(const item of pack.memories||[]){await memory.remember({...item,id:undefined,evidence:item.evidence||{}});count++;}console.log(JSON.stringify({ok:true,imported:count},null,2));return;}
help();process.exitCode=1;}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
