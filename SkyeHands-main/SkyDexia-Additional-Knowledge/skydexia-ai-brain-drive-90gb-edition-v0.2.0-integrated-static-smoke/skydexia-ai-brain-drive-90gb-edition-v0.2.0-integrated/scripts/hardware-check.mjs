import os from "node:os";
import { execFileSync } from "node:child_process";
function safe(cmd,args=[]){try{return execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{return null}}
const totalRamGb=Math.round((os.totalmem()/1024/1024/1024)*10)/10;
const cpus=os.cpus()||[];
const nvidia=safe("nvidia-smi",["--query-gpu=name,memory.total","--format=csv,noheader"]);
const gpu=nvidia?nvidia.split("\n").map(x=>x.trim()):null;
let mode="90GB Lite", models=["phi4-mini","llama3.2:3b"];
if(totalRamGb>=16){mode="90GB Lite Coding";models=["qwen2.5-coder:7b","phi4-mini","llama3.2:3b"]}
if(totalRamGb>=32){mode="90GB Pro Candidate";models=["qwen2.5-coder:7b","deepseek-coder-v2:lite optional","phi4-mini"]}
if(gpu&&totalRamGb>=32){mode="90GB GPU-assisted Pro Candidate"}
const warnings=[];
if(totalRamGb<8)warnings.push("Below 8GB RAM. Use very small models only.");
if(!process.env.OLLAMA_MODELS)warnings.push("OLLAMA_MODELS is not set. Run source .env.skydexia.");
if(!gpu)warnings.push("No NVIDIA GPU detected through nvidia-smi. CPU inference may be slower.");
console.log(JSON.stringify({ok:true,edition:"90GB",platform:os.platform(),arch:os.arch(),cpu_count:cpus.length,cpu_model:cpus[0]?.model||"unknown",ram_gb:totalRamGb,gpu_detected:gpu,ollama_models_env:process.env.OLLAMA_MODELS||null,recommended_mode:mode,recommended_models:models,warnings},null,2));
